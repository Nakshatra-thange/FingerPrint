import express, { Request, Response } from "express";
import cors from "cors";
import nacl from "tweetnacl";
import bs58 from "bs58";
import dotenv from "dotenv";
import { z } from "zod";
import {
  deactivateRelayAttestor,
  getRelayAttestorByPublicKey,
  listRelayAttestors,
  upsertRelayAttestor,
} from "../db/queries";
import { migrate } from "../db/migrate";
import { createNodeSdk } from "../shared/sdk";

dotenv.config();

const rpcUrl = process.env.SOLANA_RPC_URL ?? "http://localhost:8899";
const { keypair: relayKeypair, sdk } = createNodeSdk(
  process.env.RELAY_KEYPAIR_BASE58,
  rpcUrl
);

console.log(`[relay] Hot wallet: ${relayKeypair.publicKey.toBase58()}`);

const AttestRequestSchema = z.object({
  escrowId: z.string().regex(/^\d+$/),
  evidenceCid: z.string().max(64).optional(),
  eventTimestamp: z.string().optional(),
  attestorPubkey: z.string(),
  signature: z.string(),
});

type AttestRequest = z.infer<typeof AttestRequestSchema>;

function buildMessageToSign(req: AttestRequest): Uint8Array {
  return Buffer.from(
    [req.escrowId, req.evidenceCid ?? "", req.eventTimestamp ?? ""].join(":")
  );
}

async function verifyAttestorSignature(req: AttestRequest): Promise<boolean> {
  const attestor = await getRelayAttestorByPublicKey(req.attestorPubkey);
  if (!attestor || !attestor.active) {
    return false;
  }

  try {
    const pubkeyBytes = bs58.decode(attestor.public_key_base58);
    const sigBytes = bs58.decode(req.signature);
    const message = buildMessageToSign(req);
    return nacl.sign.detached.verify(message, sigBytes, pubkeyBytes);
  } catch {
    return false;
  }
}

function requireAdmin(req: Request, res: Response): boolean {
  const adminToken = req.headers["x-admin-token"];
  if (!process.env.RELAY_ADMIN_TOKEN || adminToken !== process.env.RELAY_ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") ?? "*" }));
app.use(express.json({ limit: "2mb" }));

app.post("/relay/attest", async (req: Request, res: Response) => {
  const parsed = AttestRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten(),
    });
  }

  const data = parsed.data;
  const attestor = await getRelayAttestorByPublicKey(data.attestorPubkey);
  if (!attestor || !attestor.active) {
    return res.status(403).json({ error: "Attestor not registered" });
  }

  if (!(await verifyAttestorSignature(data))) {
    return res.status(401).json({ error: "Invalid attestor signature" });
  }

  try {
    const signature = await sdk.attestation.submitAttestation({
      escrowId: BigInt(data.escrowId),
      attestor: relayKeypair.publicKey,
      evidenceCid: data.evidenceCid,
    });

    return res.json({
      ok: true,
      txSignature: signature,
      escrowId: data.escrowId,
      attestor: attestor.public_key_base58,
    });
  } catch (error) {
    console.error("[relay] Attestation tx failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Transaction failed",
    });
  }
});

app.post("/relay/register", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  const { name, publicKeyBase58 } = req.body as {
    name?: string;
    publicKeyBase58?: string;
  };

  if (!name || !publicKeyBase58) {
    return res.status(400).json({ error: "name and publicKeyBase58 required" });
  }

  try {
    const decoded = bs58.decode(publicKeyBase58);
    if (decoded.length !== 32) {
      throw new Error("Invalid key length");
    }
  } catch {
    return res.status(400).json({ error: "Invalid public key" });
  }

  const attestor = await upsertRelayAttestor(name, publicKeyBase58);
  return res.json({ ok: true, attestor });
});

app.post("/relay/deactivate", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  const { publicKeyBase58 } = req.body as { publicKeyBase58?: string };
  if (!publicKeyBase58) {
    return res.status(400).json({ error: "publicKeyBase58 required" });
  }

  await deactivateRelayAttestor(publicKeyBase58);
  return res.json({ ok: true });
});

app.get("/relay/attestors", async (_req, res) => {
  const attestors = await listRelayAttestors();
  res.json({
    attestors: attestors.map((attestor) => ({
      name: attestor.name,
      publicKeyBase58: attestor.public_key_base58,
      active: attestor.active,
    })),
    relayWallet: relayKeypair.publicKey.toBase58(),
  });
});

app.get("/relay/health", (_req, res) => {
  res.json({
    ok: true,
    service: "relay",
    relayWallet: relayKeypair.publicKey.toBase58(),
  });
});

const PORT = parseInt(process.env.RELAY_PORT ?? "3002", 10);

async function start() {
  await migrate();
  app.listen(PORT, () => {
    console.log(`[relay] Listening on :${PORT}`);
    console.log(`[relay] Relay wallet: ${relayKeypair.publicKey.toBase58()}`);
  });
}

start().catch((error) => {
  console.error("[relay] Failed to start:", error);
  process.exit(1);
});
