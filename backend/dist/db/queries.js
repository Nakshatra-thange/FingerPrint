"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertEscrow = upsertEscrow;
exports.updateEscrowStatus = updateEscrowStatus;
exports.getEscrowById = getEscrowById;
exports.getEscrowsByPayer = getEscrowsByPayer;
exports.getEscrowsByReceiver = getEscrowsByReceiver;
exports.getAllEscrows = getAllEscrows;
exports.insertAttestation = insertAttestation;
exports.getAttestationsByEscrow = getAttestationsByEscrow;
exports.upsertDispute = upsertDispute;
exports.getDisputeByEscrow = getDisputeByEscrow;
exports.logWebhookEvent = logWebhookEvent;
exports.markWebhookProcessed = markWebhookProcessed;
const pool_1 = require("./pool");
// ── Escrow queries ────────────────────────────────────────────────────────────
async function upsertEscrow(data) {
    if (!pool_1.pool)
        return;
    await pool_1.pool.query(`INSERT INTO escrows (
      escrow_id, escrow_pubkey, vault_pubkey, payer, receiver,
      event_description, required_attestors, threshold, amount_lamports,
      deadline_unix, dispute_window_seconds, status, threshold_met_at, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (escrow_id) DO UPDATE SET
      status          = EXCLUDED.status,
      threshold_met_at = EXCLUDED.threshold_met_at,
      last_updated    = NOW()`, [
        data.escrow_id,
        data.escrow_pubkey,
        data.vault_pubkey,
        data.payer,
        data.receiver,
        data.event_description,
        data.required_attestors,
        data.threshold,
        data.amount_lamports,
        data.deadline_unix,
        data.dispute_window_seconds,
        data.status,
        data.threshold_met_at,
        data.created_at,
    ]);
}
async function updateEscrowStatus(escrowId, status, thresholdMetAt) {
    if (!pool_1.pool)
        return;
    await pool_1.pool.query(`UPDATE escrows SET status = $1, threshold_met_at = COALESCE($2, threshold_met_at), last_updated = NOW()
     WHERE escrow_id = $3`, [status, thresholdMetAt ?? null, escrowId]);
}
async function getEscrowById(escrowId) {
    if (!pool_1.pool)
        return null;
    const { rows } = await pool_1.pool.query("SELECT * FROM escrows WHERE escrow_id = $1", [escrowId]);
    return rows[0] ?? null;
}
async function getEscrowsByPayer(payer) {
    if (!pool_1.pool)
        return [];
    const { rows } = await pool_1.pool.query("SELECT * FROM escrows WHERE payer = $1 ORDER BY indexed_at DESC", [payer]);
    return rows;
}
async function getEscrowsByReceiver(receiver) {
    if (!pool_1.pool)
        return [];
    const { rows } = await pool_1.pool.query("SELECT * FROM escrows WHERE receiver = $1 ORDER BY indexed_at DESC", [receiver]);
    return rows;
}
async function getAllEscrows(status, limit = 50, offset = 0) {
    if (!pool_1.pool)
        return [];
    const { rows } = status
        ? await pool_1.pool.query("SELECT * FROM escrows WHERE status = $1 ORDER BY indexed_at DESC LIMIT $2 OFFSET $3", [status, limit, offset])
        : await pool_1.pool.query("SELECT * FROM escrows ORDER BY indexed_at DESC LIMIT $1 OFFSET $2", [limit, offset]);
    return rows;
}
// ── Attestation queries ───────────────────────────────────────────────────────
async function insertAttestation(data) {
    if (!pool_1.pool)
        return;
    await pool_1.pool.query(`INSERT INTO attestations (escrow_id, attestor, record_pubkey, evidence_cid, timestamp_unix, tx_signature)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (escrow_id, attestor) DO NOTHING`, [
        data.escrow_id,
        data.attestor,
        data.record_pubkey,
        data.evidence_cid,
        data.timestamp_unix,
        data.tx_signature,
    ]);
}
async function getAttestationsByEscrow(escrowId) {
    if (!pool_1.pool)
        return [];
    const { rows } = await pool_1.pool.query("SELECT * FROM attestations WHERE escrow_id = $1 ORDER BY timestamp_unix ASC", [escrowId]);
    return rows;
}
// ── Dispute queries ───────────────────────────────────────────────────────────
async function upsertDispute(data) {
    if (!pool_1.pool)
        return;
    await pool_1.pool.query(`INSERT INTO disputes (
       escrow_id, dispute_pubkey, disputer, reason, counter_evidence_cid,
       status, opened_at_unix, resolved_at_unix, resolver_notes, tx_signature
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (escrow_id) DO UPDATE SET
       status           = EXCLUDED.status,
       resolved_at_unix = EXCLUDED.resolved_at_unix,
       resolver_notes   = EXCLUDED.resolver_notes`, [
        data.escrow_id,
        data.dispute_pubkey,
        data.disputer,
        data.reason,
        data.counter_evidence_cid,
        data.status,
        data.opened_at_unix,
        data.resolved_at_unix,
        data.resolver_notes,
        data.tx_signature,
    ]);
}
async function getDisputeByEscrow(escrowId) {
    if (!pool_1.pool)
        return null;
    const { rows } = await pool_1.pool.query("SELECT * FROM disputes WHERE escrow_id = $1", [escrowId]);
    return rows[0] ?? null;
}
// ── Webhook event log ─────────────────────────────────────────────────────────
async function logWebhookEvent(eventType, payload) {
    if (!pool_1.pool)
        return 0;
    const { rows } = await pool_1.pool.query("INSERT INTO webhook_events (event_type, payload) VALUES ($1, $2) RETURNING id", [eventType, JSON.stringify(payload)]);
    return rows[0].id;
}
async function markWebhookProcessed(id, error) {
    if (!pool_1.pool)
        return;
    await pool_1.pool.query("UPDATE webhook_events SET processed = TRUE, error = $1 WHERE id = $2", [error ?? null, id]);
}
