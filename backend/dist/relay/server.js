"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const bs58_1 = __importDefault(require("bs58"));
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
const queries_1 = require("../db/queries");
const migrate_1 = require("../db/migrate");
const sdk_1 = require("../shared/sdk");
dotenv_1.default.config();
const rpcUrl = process.env.SOLANA_RPC_URL ?? "http://localhost:8899";
const { keypair: relayKeypair, sdk } = (0, sdk_1.createNodeSdk)(process.env.RELAY_KEYPAIR_BASE58, rpcUrl);
console.log(`[relay] Hot wallet: ${relayKeypair.publicKey.toBase58()}`);
const AttestRequestSchema = zod_1.z.object({
    escrowId: zod_1.z.string().regex(/^\d+$/),
    evidenceCid: zod_1.z.string().max(64).optional(),
    eventTimestamp: zod_1.z.string().optional(),
    attestorPubkey: zod_1.z.string(),
    signature: zod_1.z.string(),
});
function buildMessageToSign(req) {
    return Buffer.from([req.escrowId, req.evidenceCid ?? "", req.eventTimestamp ?? ""].join(":"));
}
async function verifyAttestorSignature(req) {
    const attestor = await (0, queries_1.getRelayAttestorByPublicKey)(req.attestorPubkey);
    if (!attestor || !attestor.active) {
        return false;
    }
    try {
        const pubkeyBytes = bs58_1.default.decode(attestor.public_key_base58);
        const sigBytes = bs58_1.default.decode(req.signature);
        const message = buildMessageToSign(req);
        return tweetnacl_1.default.sign.detached.verify(message, sigBytes, pubkeyBytes);
    }
    catch {
        return false;
    }
}
function requireAdmin(req, res) {
    const adminToken = req.headers["x-admin-token"];
    if (!process.env.RELAY_ADMIN_TOKEN || adminToken !== process.env.RELAY_ADMIN_TOKEN) {
        res.status(401).json({ error: "Unauthorized" });
        return false;
    }
    return true;
}
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: process.env.ALLOWED_ORIGINS?.split(",") ?? "*" }));
app.use(express_1.default.json({ limit: "2mb" }));
app.post("/relay/attest", async (req, res) => {
    const parsed = AttestRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid request",
            details: parsed.error.flatten(),
        });
    }
    const data = parsed.data;
    const attestor = await (0, queries_1.getRelayAttestorByPublicKey)(data.attestorPubkey);
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
    }
    catch (error) {
        console.error("[relay] Attestation tx failed:", error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : "Transaction failed",
        });
    }
});
app.post("/relay/register", async (req, res) => {
    if (!requireAdmin(req, res)) {
        return;
    }
    const { name, publicKeyBase58 } = req.body;
    if (!name || !publicKeyBase58) {
        return res.status(400).json({ error: "name and publicKeyBase58 required" });
    }
    try {
        const decoded = bs58_1.default.decode(publicKeyBase58);
        if (decoded.length !== 32) {
            throw new Error("Invalid key length");
        }
    }
    catch {
        return res.status(400).json({ error: "Invalid public key" });
    }
    const attestor = await (0, queries_1.upsertRelayAttestor)(name, publicKeyBase58);
    return res.json({ ok: true, attestor });
});
app.post("/relay/deactivate", async (req, res) => {
    if (!requireAdmin(req, res)) {
        return;
    }
    const { publicKeyBase58 } = req.body;
    if (!publicKeyBase58) {
        return res.status(400).json({ error: "publicKeyBase58 required" });
    }
    await (0, queries_1.deactivateRelayAttestor)(publicKeyBase58);
    return res.json({ ok: true });
});
app.get("/relay/attestors", async (_req, res) => {
    const attestors = await (0, queries_1.listRelayAttestors)();
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
    await (0, migrate_1.migrate)();
    app.listen(PORT, () => {
        console.log(`[relay] Listening on :${PORT}`);
        console.log(`[relay] Relay wallet: ${relayKeypair.publicKey.toBase58()}`);
    });
}
start().catch((error) => {
    console.error("[relay] Failed to start:", error);
    process.exit(1);
});
