"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const queries_1 = require("../db/queries");
const migrate_1 = require("../db/migrate");
const pool_1 = require("../db/pool");
const evidence_1 = require("../shared/evidence");
const idls_1 = require("../shared/idls");
const sdk_1 = require("../shared/sdk");
const parser_1 = require("./parser");
const processor_1 = require("./processor");
const worker_1 = require("./worker");
dotenv_1.default.config();
const rpcUrl = process.env.SOLANA_RPC_URL ?? "http://localhost:8899";
const { keypair: indexerKeypair, sdk } = (0, sdk_1.createNodeSdk)(process.env.INDEXER_KEYPAIR_BASE58, rpcUrl);
const parser = new parser_1.EventParser(idls_1.escrowIdl, idls_1.attestationIdl, idls_1.disputeIdl);
const processor = new processor_1.EventProcessor(sdk);
const worker = new worker_1.EscrowWorker(sdk);
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: process.env.ALLOWED_ORIGINS?.split(",") ?? "*" }));
app.use(express_1.default.json({ limit: "25mb" }));
function parseNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
app.get("/indexer/health", (_req, res) => {
    res.json({
        ok: true,
        service: "indexer",
        rpcUrl,
        databaseEnabled: Boolean(pool_1.pool),
        wallet: indexerKeypair.publicKey.toBase58(),
    });
});
app.get("/api/health", (_req, res) => {
    res.json({
        ok: true,
        service: "api",
        databaseEnabled: Boolean(pool_1.pool),
    });
});
app.get("/api/escrows", async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const limit = parseNumber(req.query.limit, 50);
    const offset = parseNumber(req.query.offset, 0);
    const escrows = await (0, queries_1.getAllEscrows)(status, limit, offset);
    res.json({ escrows });
});
app.get("/api/escrows/by-payer/:address", async (req, res) => {
    const escrows = await (0, queries_1.getEscrowsByPayer)(req.params.address);
    res.json({ escrows });
});
app.get("/api/escrows/by-receiver/:address", async (req, res) => {
    const escrows = await (0, queries_1.getEscrowsByReceiver)(req.params.address);
    res.json({ escrows });
});
app.get("/api/escrows/by-attestor/:address", async (req, res) => {
    const escrows = await (0, queries_1.getEscrowsByAttestor)(req.params.address);
    res.json({ escrows });
});
app.get("/api/escrows/:escrowId", async (req, res) => {
    const escrow = await (0, queries_1.getEscrowById)(req.params.escrowId);
    if (!escrow) {
        return res.status(404).json({ error: "Escrow not found" });
    }
    const [attestations, dispute] = await Promise.all([
        (0, queries_1.getAttestationsByEscrow)(req.params.escrowId),
        (0, queries_1.getDisputeByEscrow)(req.params.escrowId),
    ]);
    return res.json({ escrow, attestations, dispute });
});
app.post("/api/evidence/upload", async (req, res) => {
    const { fileName, contentType, dataBase64 } = req.body;
    if (!fileName || !contentType || !dataBase64) {
        return res.status(400).json({
            error: "fileName, contentType, and dataBase64 are required",
        });
    }
    try {
        const result = await (0, evidence_1.uploadEvidenceToIpfs)({
            fileName,
            contentType,
            dataBase64,
        });
        return res.json({ ok: true, ...result });
    }
    catch (error) {
        return res.status(500).json({
            error: error instanceof Error ? error.message : "Upload failed",
        });
    }
});
app.post("/indexer/webhook", async (req, res) => {
    const payload = req.body;
    if (!payload || !Array.isArray(payload.transactions)) {
        return res.status(400).json({ error: "Invalid Helius payload" });
    }
    try {
        const events = parser.parseWebhookPayload(payload);
        await processor.processEvents(events);
        return res.json({ ok: true, eventsProcessed: events.length });
    }
    catch (error) {
        console.error("[indexer] Webhook processing failed:", error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : "Webhook processing failed",
        });
    }
});
const port = parseInt(process.env.INDEXER_PORT ?? "3001", 10);
async function start() {
    await (0, migrate_1.migrate)();
    app.listen(port, () => {
        console.log(`[indexer] Listening on :${port}`);
        console.log(`[indexer] RPC: ${rpcUrl}`);
        if (!pool_1.pool) {
            console.log("[indexer] DATABASE_URL not set; running without persistence");
        }
    });
    worker.start();
}
start().catch((error) => {
    console.error("[indexer] Failed to start:", error);
    process.exit(1);
});
