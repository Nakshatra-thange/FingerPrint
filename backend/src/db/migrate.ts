import { pool } from "./pool";

const MIGRATIONS = [
  // ── Escrows ────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS escrows (
    id                      BIGSERIAL PRIMARY KEY,
    escrow_id               BIGINT NOT NULL UNIQUE,
    escrow_pubkey           TEXT NOT NULL UNIQUE,
    vault_pubkey            TEXT NOT NULL,
    payer                   TEXT NOT NULL,
    receiver                TEXT NOT NULL,
    event_description       TEXT NOT NULL,
    required_attestors      TEXT[] NOT NULL,
    threshold               INT NOT NULL,
    amount_lamports         BIGINT NOT NULL,
    deadline_unix           BIGINT NOT NULL,
    dispute_window_seconds  BIGINT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'active',
    threshold_met_at        BIGINT,
    created_at              BIGINT NOT NULL,
    indexed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_updated            TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── Attestations ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS attestations (
    id              BIGSERIAL PRIMARY KEY,
    escrow_id       BIGINT NOT NULL REFERENCES escrows(escrow_id),
    attestor        TEXT NOT NULL,
    record_pubkey   TEXT NOT NULL UNIQUE,
    evidence_cid    TEXT,
    timestamp_unix  BIGINT NOT NULL,
    tx_signature    TEXT NOT NULL,
    indexed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(escrow_id, attestor)
  )`,

  // ── Disputes ───────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS disputes (
    id                    BIGSERIAL PRIMARY KEY,
    escrow_id             BIGINT NOT NULL REFERENCES escrows(escrow_id) UNIQUE,
    dispute_pubkey        TEXT NOT NULL,
    disputer              TEXT NOT NULL,
    reason                TEXT NOT NULL,
    counter_evidence_cid  TEXT,
    status                TEXT NOT NULL DEFAULT 'open',
    opened_at_unix        BIGINT NOT NULL,
    resolved_at_unix      BIGINT,
    resolver_notes        TEXT,
    tx_signature          TEXT NOT NULL,
    indexed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── Webhook events log (raw, for debugging / replay) ──────────────────────
  `CREATE TABLE IF NOT EXISTS webhook_events (
    id          BIGSERIAL PRIMARY KEY,
    event_type  TEXT NOT NULL,
    payload     JSONB NOT NULL,
    processed   BOOLEAN NOT NULL DEFAULT FALSE,
    error       TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── Relay attestors ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS relay_attestors (
    id                 BIGSERIAL PRIMARY KEY,
    name               TEXT NOT NULL,
    public_key_base58  TEXT NOT NULL UNIQUE,
    active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── Indexes ────────────────────────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_escrows_payer    ON escrows(payer)`,
  `CREATE INDEX IF NOT EXISTS idx_escrows_receiver ON escrows(receiver)`,
  `CREATE INDEX IF NOT EXISTS idx_escrows_status   ON escrows(status)`,
  `CREATE INDEX IF NOT EXISTS idx_attestations_escrow_id ON attestations(escrow_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attestations_attestor  ON attestations(attestor)`,
  `CREATE INDEX IF NOT EXISTS idx_relay_attestors_active ON relay_attestors(active)`,
];

export async function migrate() {
  if (!pool) {
    console.warn("[db] Skipping migrations because DATABASE_URL is not set");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const sql of MIGRATIONS) {
      await client.query(sql);
    }
    await client.query("COMMIT");
    console.log("✓ Migrations complete");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Run directly: ts-node src/db/migrate.ts
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
