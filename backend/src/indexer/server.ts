import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bs58 from "bs58";
import path from "path";
import { Connection, Keypair } from "@solana/web3.js";
import { createSDKFromKeypair } from "@fingerprint/sdk";
import { EventParser, HeliusWebhookPayload } from "./parser";
import { EventProcessor } from "./processor";

dotenv.config();

const rpcUrl = process.env.SOLANA_RPC_URL ?? "http://localhost:8899";
const indexerKeypair = process.env.INDEXER_KEYPAIR_BASE58
  ? Keypair.fromSecretKey(bs58.decode(process.env.INDEXER_KEYPAIR_BASE58))
  : Keypair.generate();

const idlRoot = path.resolve(__dirname, "../../../fingerprint/target/idl");
const escrowIdl = require(path.join(idlRoot, "escrow.json"));
const attestationIdl = require(path.join(idlRoot, "attestation.json"));
const disputeIdl = require(path.join(idlRoot, "dispute.json"));

const sdk = createSDKFromKeypair(indexerKeypair, rpcUrl, {
  escrow: escrowIdl,
  attestation: attestationIdl,
  dispute: disputeIdl,
});

const parser = new EventParser(escrowIdl, attestationIdl, disputeIdl);
const processor = new EventProcessor(sdk);

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") ?? "*" }));
app.use(express.json({ limit: "2mb" }));

app.get("/indexer/health", (_req, res) => {
  res.json({
    ok: true,
    service: "indexer",
    rpcUrl,
    databaseEnabled: Boolean(process.env.DATABASE_URL),
    wallet: indexerKeypair.publicKey.toBase58(),
  });
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
  } catch (error: any) {
    console.error("[indexer] Webhook processing failed:", error);
    return res.status(500).json({
      error: "Webhook processing failed",
      details: error?.message ?? String(error),
    });
  }
});

const port = parseInt(process.env.INDEXER_PORT ?? "3001", 10);

app.listen(port, () => {
  console.log(`[indexer] Listening on :${port}`);
  console.log(`[indexer] RPC: ${rpcUrl}`);
  if (!process.env.DATABASE_URL) {
    console.log("[indexer] DATABASE_URL not set; running without persistence");
  }
});
