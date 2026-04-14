/**
 * Attestor Relay Service
 *
 * Purpose: some attestors are automated systems (IoT sensors, ERP triggers,
 * logistics APIs) that can't sign Solana transactions directly. This relay
 * acts as a trusted proxy — it receives a signed message from the attestor's
 * backend over HTTPS, verifies the signature, and submits the on-chain
 * attestation transaction on their behalf.
 *
 * Security model:
 *   - Each permissioned attestor registers their ed25519 public key with us
 *   - To attest, they POST a payload signed with their private key
 *   - We verify the signature, then submit the tx using the relay's hot wallet
 *   - The relay's hot wallet is the on-chain attestor address for these automated attestors
 *
 * For human attestors (who have Phantom/Backpack), they sign directly in the UI
 * and don't go through this relay at all.
 */

import express, { Request, Response } from "express";
import cors from "cors";
import nacl from "tweetnacl";
import bs58 from "bs58";
import dotenv from "dotenv";
import path from "path";
import { Keypair, Connection } from "@solana/web3.js";
import { z } from "zod";
import { createSDKFromKeypair } from "@fingerprint/sdk";

dotenv.config();

// ── IDL imports ───────────────────────────────────────────────────────────────
const idlRoot = path.resolve(__dirname, "../../../fingerprint/target/idl");
const escrowIdl = require(path.join(idlRoot, "escrow.json"));
const attestationIdl = require(path.join(idlRoot, "attestation.json"));
const disputeIdl = require(path.join(idlRoot, "dispute.json"));

// ── Relay keypair (hot wallet that submits txs) ───────────────────────────────

const relayKeypair = process.env.RELAY_KEYPAIR_BASE58
  ? Keypair.fromSecretKey(bs58.decode(process.env.RELAY_KEYPAIR_BASE58))
  : Keypair.generate();

console.log(`[relay] Hot wallet: ${relayKeypair.publicKey.toBase58()}`);

// ── SDK ───────────────────────────────────────────────────────────────────────

const sdk = createSDKFromKeypair(
  relayKeypair,
  process.env.SOLANA_RPC_URL ?? "http://localhost:8899",
  { escrow: escrowIdl, attestation: attestationIdl, dispute: disputeIdl }
);

// ── Permissioned attestors registry ──────────────────────────────────────────
// In production: load from DB or config file. Keyed by base58 public key.

interface RegisteredAttestor {
  name: string;
  publicKeyBase58: string; // ed25519 key for message verification
}

// This would be loaded from DB / env in production
const REGISTERED_ATTESTORS: Map<string, RegisteredAttestor> = new Map([
  // Example: an IoT sensor with a known public key
  // ["SomeBase58PubKey", { name: "Truck TN-07 GPS sensor", publicKeyBase58: "..." }]
]);

// ── Request validation schema ─────────────────────────────────────────────────

const AttestRequestSchema = z.object({
  // The escrow to attest on
  escrowId: z.string().regex(/^\d+$/),

  // Optional IPFS CID for evidence (photo, PDF, sensor log)
  evidenceCid: z.string().max(64).optional(),

  // ISO timestamp of the real-world event (informational — stored in evidence)
  eventTimestamp: z.string().optional(),

  // The attestor's public key (must be in REGISTERED_ATTESTORS)
  attestorPubkey: z.string(),

  // ed25519 signature of: sha256(escrowId + ":" + evidenceCid + ":" + eventTimestamp)
  // Proves the attestor authorised this specific attestation
  signature: z.string(),
});

type AttestRequest = z.infer<typeof AttestRequestSchema>;

// ── Signature verification ────────────────────────────────────────────────────

function buildMessageToSign(req: AttestRequest): Uint8Array {
  const msg = [
    req.escrowId,
    req.evidenceCid ?? "",
    req.eventTimestamp ?? "",
  ].join(":");
  return Buffer.from(msg);
}

function verifyAttestorSignature(req: AttestRequest): boolean {
  const attestor = REGISTERED_ATTESTORS.get(req.attestorPubkey);
  if (!attestor) return false;

  try {
    const pubkeyBytes = bs58.decode(attestor.publicKeyBase58);
    const sigBytes = bs58.decode(req.signature);
    const message = buildMessageToSign(req);
    return nacl.sign.detached.verify(message, sigBytes, pubkeyBytes);
  } catch {
    return false;
  }
}

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") ?? "*" }));
app.use(express.json());

/**
 * POST /relay/attest
 *
 * Body: AttestRequest
 *
 * The attestor's backend calls this endpoint.
 * We verify their signature, then submit the on-chain attestation tx.
 */
app.post("/relay/attest", async (req: Request, res: Response) => {
  // 1. Validate request shape
  const parsed = AttestRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten(),
    });
  }

  const data = parsed.data;

  // 2. Verify the attestor is registered
  if (!REGISTERED_ATTESTORS.has(data.attestorPubkey)) {
    return res.status(403).json({ error: "Attestor not registered" });
  }

  // 3. Verify the signature
  if (!verifyAttestorSignature(data)) {
    return res.status(401).json({ error: "Invalid attestor signature" });
  }

  // 4. Submit the on-chain attestation
  try {
    const signature = await sdk.attestation.submitAttestation({
      escrowId: BigInt(data.escrowId),
      // The relay's own pubkey is the on-chain attestor address
      // (registered in the escrow's requiredAttestors list)
      attestor: relayKeypair.publicKey,
      evidenceCid: data.evidenceCid,
    });

    console.log(
      `[relay] Attested: escrow=${data.escrowId} attestor=${data.attestorPubkey} tx=${signature}`
    );

    return res.json({
      ok: true,
      txSignature: signature,
      escrowId: data.escrowId,
    });
  } catch (err: any) {
    console.error("[relay] Attestation tx failed:", err);
    return res.status(500).json({
      error: "Transaction failed",
      details: err.message,
    });
  }
});

/**
 * POST /relay/register
 *
 * Register a new automated attestor.
 * Protected by a bearer token in production.
 *
 * Body: { name: string; publicKeyBase58: string; adminToken: string }
 */
app.post("/relay/register", async (req: Request, res: Response) => {
  const adminToken = req.headers["x-admin-token"];
  if (adminToken !== process.env.RELAY_ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { name, publicKeyBase58 } = req.body as {
    name: string;
    publicKeyBase58: string;
  };

  if (!name || !publicKeyBase58) {
    return res.status(400).json({ error: "name and publicKeyBase58 required" });
  }

  // Validate it's a valid base58 key
  try {
    const decoded = bs58.decode(publicKeyBase58);
    if (decoded.length !== 32) throw new Error("Invalid key length");
  } catch {
    return res.status(400).json({ error: "Invalid public key" });
  }

  REGISTERED_ATTESTORS.set(publicKeyBase58, { name, publicKeyBase58 });

  console.log(`[relay] Registered attestor: ${name} (${publicKeyBase58})`);

  return res.json({ ok: true });
});

/**
 * GET /relay/attestors
 * Lists registered attestors (public keys and names only — no secrets).
 */
app.get("/relay/attestors", (_req, res) => {
  const attestors = Array.from(REGISTERED_ATTESTORS.values()).map((a) => ({
    name: a.name,
    publicKeyBase58: a.publicKeyBase58,
  }));
  res.json({ attestors, relayWallet: relayKeypair.publicKey.toBase58() });
});

/**
 * GET /relay/health
 */
app.get("/relay/health", (_req, res) => {
  res.json({
    ok: true,
    service: "relay",
    relayWallet: relayKeypair.publicKey.toBase58(),
    registeredAttestors: REGISTERED_ATTESTORS.size,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.RELAY_PORT ?? "3002");

app.listen(PORT, () => {
  console.log(`[relay] Listening on :${PORT}`);
  console.log(`[relay] Relay wallet: ${relayKeypair.publicKey.toBase58()}`);
});
