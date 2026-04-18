import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  getAllEscrows,
  getAttestationsByEscrow,
  getDisputeByEscrow,
  getEscrowById,
  getEscrowsByAttestor,
  getEscrowsByPayer,
  getEscrowsByReceiver,
} from "../db/queries";
import { migrate } from "../db/migrate";
import { pool } from "../db/pool";
import { uploadEvidenceToIpfs } from "../shared/evidence";
import { escrowIdl, attestationIdl, disputeIdl } from "../shared/idls";
import { createNodeSdk } from "../shared/sdk";
import { EventParser, HeliusWebhookPayload } from "./parser";
import { EventProcessor } from "./processor";
import { EscrowWorker } from "./worker";

dotenv.config();

const rpcUrl = process.env.SOLANA_RPC_URL ?? "http://localhost:8899";
const { keypair: indexerKeypair, sdk } = createNodeSdk(
  process.env.INDEXER_KEYPAIR_BASE58,
  rpcUrl
);

const parser = new EventParser(escrowIdl, attestationIdl, disputeIdl);
const processor = new EventProcessor(sdk);
const worker = new EscrowWorker(sdk);

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") ?? "*" }));
app.use(express.json({ limit: "25mb" }));

function parseNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

app.get("/indexer/health", (_req, res) => {
  res.json({
    ok: true,
    service: "indexer",
    rpcUrl,
    databaseEnabled: Boolean(pool),
    wallet: indexerKeypair.publicKey.toBase58(),
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "api",
    databaseEnabled: Boolean(pool),
  });
});

app.get("/api/escrows", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const limit = parseNumber(req.query.limit, 50);
  const offset = parseNumber(req.query.offset, 0);

  const escrows = await getAllEscrows(status, limit, offset);
  res.json({ escrows });
});

app.get("/api/escrows/by-payer/:address", async (req, res) => {
  const escrows = await getEscrowsByPayer(req.params.address);
  res.json({ escrows });
});

app.get("/api/escrows/by-receiver/:address", async (req, res) => {
  const escrows = await getEscrowsByReceiver(req.params.address);
  res.json({ escrows });
});

app.get("/api/escrows/by-attestor/:address", async (req, res) => {
  const escrows = await getEscrowsByAttestor(req.params.address);
  res.json({ escrows });
});

app.get("/api/escrows/:escrowId", async (req, res) => {
  const escrow = await getEscrowById(req.params.escrowId);
  if (!escrow) {
    return res.status(404).json({ error: "Escrow not found" });
  }

  const [attestations, dispute] = await Promise.all([
    getAttestationsByEscrow(req.params.escrowId),
    getDisputeByEscrow(req.params.escrowId),
  ]);

  return res.json({ escrow, attestations, dispute });
});

app.post("/api/evidence/upload", async (req, res) => {
  const { fileName, contentType, dataBase64 } = req.body as {
    fileName?: string;
    contentType?: string;
    dataBase64?: string;
  };

  if (!fileName || !contentType || !dataBase64) {
    return res.status(400).json({
      error: "fileName, contentType, and dataBase64 are required",
    });
  }

  try {
    const result = await uploadEvidenceToIpfs({
      fileName,
      contentType,
      dataBase64,
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Upload failed",
    });
  }
});

app.post("/indexer/webhook", async (req, res) => {
  const payload = req.body as HeliusWebhookPayload;

  if (!payload || !Array.isArray(payload.transactions)) {
    return res.status(400).json({ error: "Invalid Helius payload" });
  }

  try {
    const events = parser.parseWebhookPayload(payload);
    await processor.processEvents(events);
    return res.json({ ok: true, eventsProcessed: events.length });
  } catch (error) {
    console.error("[indexer] Webhook processing failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Webhook processing failed",
    });
  }
});

const port = parseInt(process.env.INDEXER_PORT ?? "3001", 10);

async function start() {
  await migrate();

  app.listen(port, () => {
    console.log(`[indexer] Listening on :${port}`);
    console.log(`[indexer] RPC: ${rpcUrl}`);
    if (!pool) {
      console.log("[indexer] DATABASE_URL not set; running without persistence");
    }
  });

  worker.start();
}

start().catch((error) => {
  console.error("[indexer] Failed to start:", error);
  process.exit(1);
});
