import { pool } from "./pool";
import { PoolClient } from "pg";

// ── Types matching DB rows ────────────────────────────────────────────────────

export interface EscrowRow {
  id: number;
  escrow_id: string;
  escrow_pubkey: string;
  vault_pubkey: string;
  payer: string;
  receiver: string;
  event_description: string;
  required_attestors: string[];
  threshold: number;
  amount_lamports: string;
  deadline_unix: string;
  dispute_window_seconds: string;
  status: string;
  threshold_met_at: string | null;
  created_at: string;
  indexed_at: string;
  last_updated: string;
}

export interface AttestationRow {
  id: number;
  escrow_id: string;
  attestor: string;
  record_pubkey: string;
  evidence_cid: string | null;
  timestamp_unix: string;
  tx_signature: string;
  indexed_at: string;
}

export interface DisputeRow {
  id: number;
  escrow_id: string;
  dispute_pubkey: string;
  disputer: string;
  reason: string;
  counter_evidence_cid: string | null;
  status: string;
  opened_at_unix: string;
  resolved_at_unix: string | null;
  resolver_notes: string | null;
  tx_signature: string;
  indexed_at: string;
}

// ── Escrow queries ────────────────────────────────────────────────────────────

export async function upsertEscrow(
  data: Omit<EscrowRow, "id" | "indexed_at" | "last_updated">
): Promise<void> {
  await pool.query(
    `INSERT INTO escrows (
      escrow_id, escrow_pubkey, vault_pubkey, payer, receiver,
      event_description, required_attestors, threshold, amount_lamports,
      deadline_unix, dispute_window_seconds, status, threshold_met_at, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (escrow_id) DO UPDATE SET
      status          = EXCLUDED.status,
      threshold_met_at = EXCLUDED.threshold_met_at,
      last_updated    = NOW()`,
    [
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
    ]
  );
}

export async function updateEscrowStatus(
  escrowId: string,
  status: string,
  thresholdMetAt?: string | null
): Promise<void> {
  await pool.query(
    `UPDATE escrows SET status = $1, threshold_met_at = COALESCE($2, threshold_met_at), last_updated = NOW()
     WHERE escrow_id = $3`,
    [status, thresholdMetAt ?? null, escrowId]
  );
}

export async function getEscrowById(escrowId: string): Promise<EscrowRow | null> {
  const { rows } = await pool.query<EscrowRow>(
    "SELECT * FROM escrows WHERE escrow_id = $1",
    [escrowId]
  );
  return rows[0] ?? null;
}

export async function getEscrowsByPayer(payer: string): Promise<EscrowRow[]> {
  const { rows } = await pool.query<EscrowRow>(
    "SELECT * FROM escrows WHERE payer = $1 ORDER BY indexed_at DESC",
    [payer]
  );
  return rows;
}

export async function getEscrowsByReceiver(receiver: string): Promise<EscrowRow[]> {
  const { rows } = await pool.query<EscrowRow>(
    "SELECT * FROM escrows WHERE receiver = $1 ORDER BY indexed_at DESC",
    [receiver]
  );
  return rows;
}

export async function getAllEscrows(
  status?: string,
  limit = 50,
  offset = 0
): Promise<EscrowRow[]> {
  const { rows } = status
    ? await pool.query<EscrowRow>(
        "SELECT * FROM escrows WHERE status = $1 ORDER BY indexed_at DESC LIMIT $2 OFFSET $3",
        [status, limit, offset]
      )
    : await pool.query<EscrowRow>(
        "SELECT * FROM escrows ORDER BY indexed_at DESC LIMIT $1 OFFSET $2",
        [limit, offset]
      );
  return rows;
}

// ── Attestation queries ───────────────────────────────────────────────────────

export async function insertAttestation(
  data: Omit<AttestationRow, "id" | "indexed_at">
): Promise<void> {
  await pool.query(
    `INSERT INTO attestations (escrow_id, attestor, record_pubkey, evidence_cid, timestamp_unix, tx_signature)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (escrow_id, attestor) DO NOTHING`,
    [
      data.escrow_id,
      data.attestor,
      data.record_pubkey,
      data.evidence_cid,
      data.timestamp_unix,
      data.tx_signature,
    ]
  );
}

export async function getAttestationsByEscrow(
  escrowId: string
): Promise<AttestationRow[]> {
  const { rows } = await pool.query<AttestationRow>(
    "SELECT * FROM attestations WHERE escrow_id = $1 ORDER BY timestamp_unix ASC",
    [escrowId]
  );
  return rows;
}

// ── Dispute queries ───────────────────────────────────────────────────────────

export async function upsertDispute(
  data: Omit<DisputeRow, "id" | "indexed_at">
): Promise<void> {
  await pool.query(
    `INSERT INTO disputes (
       escrow_id, dispute_pubkey, disputer, reason, counter_evidence_cid,
       status, opened_at_unix, resolved_at_unix, resolver_notes, tx_signature
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (escrow_id) DO UPDATE SET
       status           = EXCLUDED.status,
       resolved_at_unix = EXCLUDED.resolved_at_unix,
       resolver_notes   = EXCLUDED.resolver_notes`,
    [
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
    ]
  );
}

export async function getDisputeByEscrow(
  escrowId: string
): Promise<DisputeRow | null> {
  const { rows } = await pool.query<DisputeRow>(
    "SELECT * FROM disputes WHERE escrow_id = $1",
    [escrowId]
  );
  return rows[0] ?? null;
}

// ── Webhook event log ─────────────────────────────────────────────────────────

export async function logWebhookEvent(
  eventType: string,
  payload: unknown
): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO webhook_events (event_type, payload) VALUES ($1, $2) RETURNING id",
    [eventType, JSON.stringify(payload)]
  );
  return rows[0].id;
}

export async function markWebhookProcessed(
  id: number,
  error?: string
): Promise<void> {
  await pool.query(
    "UPDATE webhook_events SET processed = TRUE, error = $1 WHERE id = $2",
    [error ?? null, id]
  );
}