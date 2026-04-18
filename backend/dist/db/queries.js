"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertEscrow = upsertEscrow;
exports.updateEscrowStatus = updateEscrowStatus;
exports.getEscrowById = getEscrowById;
exports.getEscrowsByPayer = getEscrowsByPayer;
exports.getEscrowsByReceiver = getEscrowsByReceiver;
exports.getEscrowsByAttestor = getEscrowsByAttestor;
exports.getAllEscrows = getAllEscrows;
exports.insertAttestation = insertAttestation;
exports.getAttestationsByEscrow = getAttestationsByEscrow;
exports.upsertDispute = upsertDispute;
exports.getDisputeByEscrow = getDisputeByEscrow;
exports.logWebhookEvent = logWebhookEvent;
exports.markWebhookProcessed = markWebhookProcessed;
exports.getEscrowsEligibleForRelease = getEscrowsEligibleForRelease;
exports.getEscrowsEligibleForRefund = getEscrowsEligibleForRefund;
exports.listRelayAttestors = listRelayAttestors;
exports.getRelayAttestorByPublicKey = getRelayAttestorByPublicKey;
exports.upsertRelayAttestor = upsertRelayAttestor;
exports.deactivateRelayAttestor = deactivateRelayAttestor;
const pool_1 = require("./pool");
function escrowSelect(extra = "") {
    return `
    SELECT
      e.*,
      COALESCE(ac.attestation_count, 0)::int AS attestation_count
      ${extra}
    FROM escrows e
    LEFT JOIN (
      SELECT escrow_id, COUNT(*) AS attestation_count
      FROM attestations
      GROUP BY escrow_id
    ) ac ON ac.escrow_id = e.escrow_id
  `;
}
async function upsertEscrow(data) {
    if (!pool_1.pool)
        return;
    await pool_1.pool.query(`INSERT INTO escrows (
      escrow_id, escrow_pubkey, vault_pubkey, payer, receiver,
      event_description, required_attestors, threshold, amount_lamports,
      deadline_unix, dispute_window_seconds, status, threshold_met_at, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (escrow_id) DO UPDATE SET
      escrow_pubkey = EXCLUDED.escrow_pubkey,
      vault_pubkey = EXCLUDED.vault_pubkey,
      payer = EXCLUDED.payer,
      receiver = EXCLUDED.receiver,
      event_description = EXCLUDED.event_description,
      required_attestors = EXCLUDED.required_attestors,
      threshold = EXCLUDED.threshold,
      amount_lamports = EXCLUDED.amount_lamports,
      deadline_unix = EXCLUDED.deadline_unix,
      dispute_window_seconds = EXCLUDED.dispute_window_seconds,
      status = EXCLUDED.status,
      threshold_met_at = EXCLUDED.threshold_met_at,
      created_at = EXCLUDED.created_at,
      last_updated = NOW()`, [
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
    await pool_1.pool.query(`UPDATE escrows
     SET status = $1,
         threshold_met_at = COALESCE($2, threshold_met_at),
         last_updated = NOW()
     WHERE escrow_id = $3`, [status, thresholdMetAt ?? null, escrowId]);
}
async function getEscrowById(escrowId) {
    if (!pool_1.pool)
        return null;
    const { rows } = await pool_1.pool.query(`${escrowSelect()} WHERE e.escrow_id = $1`, [escrowId]);
    return rows[0] ?? null;
}
async function getEscrowsByPayer(payer) {
    if (!pool_1.pool)
        return [];
    const { rows } = await pool_1.pool.query(`${escrowSelect()} WHERE e.payer = $1 ORDER BY e.created_at DESC`, [payer]);
    return rows;
}
async function getEscrowsByReceiver(receiver) {
    if (!pool_1.pool)
        return [];
    const { rows } = await pool_1.pool.query(`${escrowSelect()} WHERE e.receiver = $1 ORDER BY e.created_at DESC`, [receiver]);
    return rows;
}
async function getEscrowsByAttestor(attestor) {
    if (!pool_1.pool)
        return [];
    const { rows } = await pool_1.pool.query(`${escrowSelect(`
      , a.evidence_cid AS my_evidence_cid,
        a.tx_signature AS my_tx_signature,
        a.timestamp_unix::text AS my_timestamp_unix,
        (a.id IS NOT NULL) AS my_attested
    `)}
     LEFT JOIN attestations a
       ON a.escrow_id = e.escrow_id
      AND a.attestor = $1
     WHERE $1 = ANY(e.required_attestors)
     ORDER BY e.created_at DESC`, [attestor]);
    return rows;
}
async function getAllEscrows(status, limit = 50, offset = 0) {
    if (!pool_1.pool)
        return [];
    const { rows } = status
        ? await pool_1.pool.query(`${escrowSelect()} WHERE e.status = $1 ORDER BY e.created_at DESC LIMIT $2 OFFSET $3`, [status, limit, offset])
        : await pool_1.pool.query(`${escrowSelect()} ORDER BY e.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    return rows;
}
async function insertAttestation(data) {
    if (!pool_1.pool)
        return;
    await pool_1.pool.query(`INSERT INTO attestations (
      escrow_id, attestor, record_pubkey, evidence_cid, timestamp_unix, tx_signature
    )
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (escrow_id, attestor) DO UPDATE SET
      record_pubkey = EXCLUDED.record_pubkey,
      evidence_cid = EXCLUDED.evidence_cid,
      timestamp_unix = EXCLUDED.timestamp_unix,
      tx_signature = EXCLUDED.tx_signature`, [
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
    const { rows } = await pool_1.pool.query(`SELECT * FROM attestations
     WHERE escrow_id = $1
     ORDER BY timestamp_unix ASC`, [escrowId]);
    return rows;
}
async function upsertDispute(data) {
    if (!pool_1.pool)
        return;
    await pool_1.pool.query(`INSERT INTO disputes (
       escrow_id, dispute_pubkey, disputer, reason, counter_evidence_cid,
       status, opened_at_unix, resolved_at_unix, resolver_notes, tx_signature
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (escrow_id) DO UPDATE SET
       dispute_pubkey = COALESCE(NULLIF(EXCLUDED.dispute_pubkey, ''), disputes.dispute_pubkey),
       disputer = COALESCE(NULLIF(EXCLUDED.disputer, ''), disputes.disputer),
       reason = COALESCE(NULLIF(EXCLUDED.reason, ''), disputes.reason),
       counter_evidence_cid = COALESCE(EXCLUDED.counter_evidence_cid, disputes.counter_evidence_cid),
       status = EXCLUDED.status,
       opened_at_unix = CASE
         WHEN EXCLUDED.opened_at_unix = '0' THEN disputes.opened_at_unix
         ELSE EXCLUDED.opened_at_unix
       END,
       resolved_at_unix = EXCLUDED.resolved_at_unix,
       resolver_notes = EXCLUDED.resolver_notes,
       tx_signature = EXCLUDED.tx_signature`, [
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
async function logWebhookEvent(eventType, payload) {
    if (!pool_1.pool)
        return 0;
    const { rows } = await pool_1.pool.query(`INSERT INTO webhook_events (event_type, payload)
     VALUES ($1, $2)
     RETURNING id`, [eventType, JSON.stringify(payload)]);
    return rows[0].id;
}
async function markWebhookProcessed(id, error) {
    if (!pool_1.pool || id === 0)
        return;
    await pool_1.pool.query(`UPDATE webhook_events
     SET processed = TRUE, error = $1
     WHERE id = $2`, [error ?? null, id]);
}
async function getEscrowsEligibleForRelease(nowUnix) {
    if (!pool_1.pool)
        return [];
    const { rows } = await pool_1.pool.query(`${escrowSelect()}
     WHERE e.status = 'thresholdMet'
       AND e.threshold_met_at IS NOT NULL
       AND (e.threshold_met_at + e.dispute_window_seconds) <= $1
     ORDER BY e.created_at ASC`, [nowUnix]);
    return rows;
}
async function getEscrowsEligibleForRefund(nowUnix) {
    if (!pool_1.pool)
        return [];
    const { rows } = await pool_1.pool.query(`${escrowSelect()}
     WHERE e.status = 'active'
       AND e.deadline_unix < $1
     ORDER BY e.created_at ASC`, [nowUnix]);
    return rows;
}
async function listRelayAttestors() {
    if (!pool_1.pool)
        return [];
    const { rows } = await pool_1.pool.query(`SELECT * FROM relay_attestors ORDER BY created_at DESC`);
    return rows;
}
async function getRelayAttestorByPublicKey(publicKeyBase58) {
    if (!pool_1.pool)
        return null;
    const { rows } = await pool_1.pool.query(`SELECT * FROM relay_attestors WHERE public_key_base58 = $1`, [publicKeyBase58]);
    return rows[0] ?? null;
}
async function upsertRelayAttestor(name, publicKeyBase58) {
    if (!pool_1.pool)
        return null;
    const { rows } = await pool_1.pool.query(`INSERT INTO relay_attestors (name, public_key_base58, active)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (public_key_base58) DO UPDATE SET
       name = EXCLUDED.name,
       active = TRUE,
       updated_at = NOW()
     RETURNING *`, [name, publicKeyBase58]);
    return rows[0] ?? null;
}
async function deactivateRelayAttestor(publicKeyBase58) {
    if (!pool_1.pool)
        return;
    await pool_1.pool.query(`UPDATE relay_attestors
     SET active = FALSE, updated_at = NOW()
     WHERE public_key_base58 = $1`, [publicKeyBase58]);
}
