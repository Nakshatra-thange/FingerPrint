"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const bs58_1 = __importDefault(require("bs58"));
const path_1 = __importDefault(require("path"));
const web3_js_1 = require("@solana/web3.js");
const sdk_1 = require("@fingerprint/sdk");
const parser_1 = require("./parser");
const processor_1 = require("./processor");
dotenv_1.default.config();
const rpcUrl = process.env.SOLANA_RPC_URL ?? "http://localhost:8899";
const indexerKeypair = process.env.INDEXER_KEYPAIR_BASE58
    ? web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(process.env.INDEXER_KEYPAIR_BASE58))
    : web3_js_1.Keypair.generate();
const idlRoot = path_1.default.resolve(__dirname, "../../../fingerprint/target/idl");
const escrowIdl = require(path_1.default.join(idlRoot, "escrow.json"));
const attestationIdl = require(path_1.default.join(idlRoot, "attestation.json"));
const disputeIdl = require(path_1.default.join(idlRoot, "dispute.json"));
const sdk = (0, sdk_1.createSDKFromKeypair)(indexerKeypair, rpcUrl, {
    escrow: escrowIdl,
    attestation: attestationIdl,
    dispute: disputeIdl,
});
const parser = new parser_1.EventParser(escrowIdl, attestationIdl, disputeIdl);
const processor = new processor_1.EventProcessor(sdk);
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: process.env.ALLOWED_ORIGINS?.split(",") ?? "*" }));
app.use(express_1.default.json({ limit: "2mb" }));
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
