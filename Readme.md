# Fingerprint

Fingerprint is a multi-party attestation escrow on Solana.

The idea is simple:

- A payer locks money in escrow.
- The payer defines an event in plain language.
- The payer chooses a list of attestors and a threshold.
- Attestors sign when the event really happened.
- When the threshold is met, the escrow moves into a dispute window.
- If nobody disputes in time, funds are released automatically.
- If the deadline passes before the threshold is met, funds return to the payer.
- If someone disputes, a resolver decides whether the receiver gets paid or the payer gets refunded.

This removes the usual “trust me, I’ll release it later” middle step. The rules live in the protocol.

## What we built

This project has four parts.

### 1. On-chain programs

There are three Anchor programs inside `fingerprint/programs`.

- `escrow`
  It creates the escrow, holds the SOL, releases funds, refunds funds, and tracks status.

- `attestation`
  It stores the required attestors, records attestations, and marks the escrow as threshold-met when enough attestors have signed.

- `dispute`
  It opens disputes, freezes the escrow while the dispute is active, and resolves the final payout.

The main escrow statuses are:

- `active`
- `thresholdMet`
- `disputed`
- `released`
- `refunded`

### 2. SDK

The SDK is in `sdk/`.

It wraps the program instructions so the frontend and backend do not need to manually build Anchor calls everywhere.

The SDK has:

- `EscrowClient`
- `AttestationClient`
- `DisputeClient`
- `FingerprintSDK`

There is a browser-safe entry for the frontend and a Node entry for backend services.

### 3. Backend

The backend is in `backend/`.

There are two services.

- `indexer`
  This service receives Helius webhooks, parses Anchor events, stores escrow state in Postgres, exposes REST endpoints for the frontend, uploads evidence to IPFS through Pinata, and runs a worker that auto-releases or auto-refunds escrows.

- `relay`
  This service is for automated attestors. It verifies signed requests and submits attestation transactions using the relay wallet.

### 4. Frontend

The frontend is in `fingerprint-escrow/`.

It is a Vite + React app with wallet connection and four main flows:

- payer dashboard
- attestor panel
- explorer
- escrow detail page

The dashboard creates real escrows on-chain.
The attestor panel shows real pending attestations from the indexer.
The detail page shows live progress, dispute status, and resolver actions.

## How the protocol works

### Happy path

1. The payer creates an escrow.
2. Funds move into the escrow vault PDA.
3. The payer also initializes the attestor registry.
4. Attestors submit attestations.
5. Once the threshold is met, the escrow moves to `thresholdMet`.
6. The dispute window starts.
7. If nobody disputes before the window ends, the backend worker calls release and funds go to the receiver.

### Timeout path

1. The escrow stays `active`.
2. The deadline passes before enough attestations arrive.
3. The backend worker calls refund.
4. Funds go back to the payer.

### Dispute path

1. The threshold is met.
2. During the dispute window, a dispute can be opened with a reason and optional evidence CID.
3. The escrow moves to `disputed`.
4. The resolver wallet decides the result.
5. Funds go either to the receiver or back to the payer.

## Important design choice

The dispute window is the main trust control in this system.

Without it, funds would release the second the threshold is met.
That is fast, but it gives no room to challenge a bad attestation.

With a dispute window:

- release is still automatic
- payout is not left to manual approval
- the payer still gets a chance to challenge

That is the balance this protocol is trying to strike.

## Folder layout

```text
FingerPrint/
├── fingerprint/          # Anchor workspace
├── sdk/                  # TypeScript SDK
├── backend/              # Indexer + relay services
└── fingerprint-escrow/   # Frontend
```

## REST API

The indexer exposes the endpoints the frontend uses.

- `GET /api/health`
- `GET /api/escrows`
- `GET /api/escrows/by-payer/:address`
- `GET /api/escrows/by-receiver/:address`
- `GET /api/escrows/by-attestor/:address`
- `GET /api/escrows/:escrowId`
- `POST /api/evidence/upload`
- `POST /indexer/webhook`

The relay exposes:

- `GET /relay/health`
- `GET /relay/attestors`
- `POST /relay/register`
- `POST /relay/deactivate`
- `POST /relay/attest`

## Database tables

The backend migrations create these tables:

- `escrows`
- `attestations`
- `disputes`
- `webhook_events`
- `relay_attestors`

## Environment variables

### Frontend

Set these in `fingerprint-escrow`.

```bash
VITE_RPC_URL=
VITE_INDEXER_URL=
```

### Backend

Set these in `backend`.

```bash
SOLANA_RPC_URL=
DATABASE_URL=
INDEXER_KEYPAIR_BASE58=
RELAY_KEYPAIR_BASE58=
RELAY_ADMIN_TOKEN=
PINATA_JWT=
ALLOWED_ORIGINS=
INDEXER_PORT=3001
RELAY_PORT=3002
WORKER_INTERVAL_MS=30000
```

### Notes

- `PINATA_JWT` is used for evidence uploads.
- `RELAY_ADMIN_TOKEN` protects attestor registration.
- `INDEXER_KEYPAIR_BASE58` is the wallet that pays fees for auto-release and auto-refund worker transactions.
- `RELAY_KEYPAIR_BASE58` is the wallet used by the relay when it submits automated attestations.

## Running the project

### 1. Build the programs

From `fingerprint/`:

```bash
anchor build
```

### 2. Build the SDK

From `sdk/`:

```bash
npm run build
```

### 3. Run backend migrations

From `backend/`:

```bash
npm run db:migrate
```

### 4. Start the backend services

From `backend/`:

```bash
npm run dev:indexer
npm run dev:relay
```

### 5. Start the frontend

From `fingerprint-escrow/`:

```bash
npm run dev
```

## Verification commands

These are the main checks used during development:

```bash
# frontend
cd fingerprint-escrow
npx tsc --noEmit -p tsconfig.app.json
npm run build

# sdk
cd ../sdk
npm run build

# backend
cd ../backend
npm run build

# anchor
cd ../fingerprint
anchor build
```

## What is working now

- real escrow creation from the dashboard
- real attestation flow from the attestor panel
- real dispute open flow
- resolver UI for dispute resolution
- indexer-backed explorer and detail pages
- auto-release worker after dispute window
- auto-refund worker after deadline
- evidence upload to IPFS through Pinata
- persistent relay attestors in Postgres

## Current trust model

This protocol removes the trusted payout middleman.
It does not remove the problem of dishonest attestors.

If the chosen attestors collude, they can still lie.
That is the main limitation of this version.

What this system does solve is:

- who holds the money while everyone waits
- when money can move
- how disputes are handled
- how the rules are enforced without manual release

## Why this project matters

A lot of real payments get delayed because one side says the job is done, the other side says it is not, and the money sits with a broker, ops team, finance team, or marketplace admin.

Fingerprint changes that flow:

- the conditions are defined up front
- the people who confirm the event are explicit
- the payout logic is automatic
- the dispute path is part of the protocol, not an afterthought

That makes it useful for things like:

- freight delivery
- warehouse confirmations
- milestone-based contractor payments
- audits
- inspections
- vendor release approvals

## Final note

This is a working protocol demo built to show the full path:

lock funds -> collect attestations -> wait through dispute window -> auto-release or dispute -> final payout

That full path is the point of the project.
