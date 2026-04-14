"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const bs58_1 = __importDefault(require("bs58"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const web3_js_1 = require("@solana/web3.js");
const zod_1 = require("zod");
const sdk_1 = require("@fingerprint/sdk");
dotenv_1.default.config();
// ── IDL imports ───────────────────────────────────────────────────────────────
const idlRoot = path_1.default.resolve(__dirname, "../../../fingerprint/target/idl");
const escrowIdl = require(path_1.default.join(idlRoot, "escrow.json"));
const attestationIdl = require(path_1.default.join(idlRoot, "attestation.json"));
const disputeIdl = require(path_1.default.join(idlRoot, "dispute.json"));
// ── Relay keypair (hot wallet that submits txs) ───────────────────────────────
const relayKeypair = process.env.RELAY_KEYPAIR_BASE58
    ? web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(process.env.RELAY_KEYPAIR_BASE58))
    : web3_js_1.Keypair.generate();
console.log(`[relay] Hot wallet: ${relayKeypair.publicKey.toBase58()}`);
// ── SDK ───────────────────────────────────────────────────────────────────────
const sdk = (0, sdk_1.createSDKFromKeypair)(relayKeypair, process.env.SOLANA_RPC_URL ?? "http://localhost:8899", { escrow: escrowIdl, attestation: attestationIdl, dispute: disputeIdl });
// This would be loaded from DB / env in production
const REGISTERED_ATTESTORS = new Map([
// Example: an IoT sensor with a known public key
// ["SomeBase58PubKey", { name: "Truck TN-07 GPS sensor", publicKeyBase58: "..." }]
]);
// ── Request validation schema ─────────────────────────────────────────────────
const AttestRequestSchema = zod_1.z.object({
    // The escrow to attest on
    escrowId: zod_1.z.string().regex(/^\d+$/),
    // Optional IPFS CID for evidence (photo, PDF, sensor log)
    evidenceCid: zod_1.z.string().max(64).optional(),
    // ISO timestamp of the real-world event (informational — stored in evidence)
    eventTimestamp: zod_1.z.string().optional(),
    // The attestor's public key (must be in REGISTERED_ATTESTORS)
    attestorPubkey: zod_1.z.string(),
    // ed25519 signature of: sha256(escrowId + ":" + evidenceCid + ":" + eventTimestamp)
    // Proves the attestor authorised this specific attestation
    signature: zod_1.z.string(),
});
// ── Signature verification ────────────────────────────────────────────────────
function buildMessageToSign(req) {
    const msg = [
        req.escrowId,
        req.evidenceCid ?? "",
        req.eventTimestamp ?? "",
    ].join(":");
    return Buffer.from(msg);
}
function verifyAttestorSignature(req) {
    const attestor = REGISTERED_ATTESTORS.get(req.attestorPubkey);
    if (!attestor)
        return false;
    try {
        const pubkeyBytes = bs58_1.default.decode(attestor.publicKeyBase58);
        const sigBytes = bs58_1.default.decode(req.signature);
        const message = buildMessageToSign(req);
        return tweetnacl_1.default.sign.detached.verify(message, sigBytes, pubkeyBytes);
    }
    catch {
        return false;
    }
}
// ── Express app ───────────────────────────────────────────────────────────────
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: process.env.ALLOWED_ORIGINS?.split(",") ?? "*" }));
app.use(express_1.default.json());
/**
 * POST /relay/attest
 *
 * Body: AttestRequest
 *
 * The attestor's backend calls this endpoint.
 * We verify their signature, then submit the on-chain attestation tx.
 */
app.post("/relay/attest", async (req, res) => {
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
        console.log(`[relay] Attested: escrow=${data.escrowId} attestor=${data.attestorPubkey} tx=${signature}`);
        return res.json({
            ok: true,
            txSignature: signature,
            escrowId: data.escrowId,
        });
    }
    catch (err) {
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
app.post("/relay/register", async (req, res) => {
    const adminToken = req.headers["x-admin-token"];
    if (adminToken !== process.env.RELAY_ADMIN_TOKEN) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { name, publicKeyBase58 } = req.body;
    if (!name || !publicKeyBase58) {
        return res.status(400).json({ error: "name and publicKeyBase58 required" });
    }
    // Validate it's a valid base58 key
    try {
        const decoded = bs58_1.default.decode(publicKeyBase58);
        if (decoded.length !== 32)
            throw new Error("Invalid key length");
    }
    catch {
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
