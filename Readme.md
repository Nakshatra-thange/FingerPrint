# Fingerprint — Day 1

Three Anchor programs. Nothing else. Get this right before touching the SDK or frontend.

## Programs

| Program | ID (placeholder) | Responsibility |
|---|---|---|
| `escrow` | `EscR111...` | Lock SOL, release, refund, status transitions |
| `attestation` | `AtEs111...` | Register attestors, accept signed attestations, CPI to escrow on threshold |
| `dispute` | `DiSp111...` | Open dispute (freeze escrow), resolver decides outcome |

## PDAs

```
escrow:      ["escrow",      escrow_id_le_bytes]
vault:       ["vault",       escrow_id_le_bytes]   ← holds SOL
registry:    ["registry",    escrow_id_le_bytes]
attestation: ["attestation", escrow_id_le_bytes, attestor_pubkey]
dispute:     ["dispute",     escrow_id_le_bytes]
```

## Happy path flow

```
createEscrow        (payer)
  └── initRegistry  (payer)
        └── submitAttestation × threshold  (attestors)
              └── [CPI] mark_threshold_met (attestation → escrow)
                    └── [wait 24h dispute window]
                          └── releaseFunds (anyone)
```

## Dispute path flow

```
...threshold met...
  └── openDispute          (payer, within window)
        └── [CPI] freeze_for_dispute (dispute → escrow)
              └── resolveDispute     (resolver multisig)
                    └── [CPI] resolve_dispute (dispute → escrow)
                          └── funds → receiver OR payer
```

## Setup

```bash
# Install
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.29.0 && avm use 0.29.0
solana-keygen new  # if you don't have a keypair

# Build
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Update program IDs in Anchor.toml and lib.rs files after deploy, then rebuild

# Test (localnet)
anchor test
```

## After deploy — update program IDs

1. Run `anchor build` to get your program IDs
2. Replace the placeholder IDs in:
   - `Anchor.toml` → `[programs.localnet]`
   - `programs/escrow/src/lib.rs` → `declare_id!` + `ATTESTATION_PROGRAM_ID` + `DISPUTE_PROGRAM_ID`
   - `programs/attestation/src/lib.rs` → `declare_id!`
   - `programs/dispute/src/lib.rs` → `declare_id!` + `RESOLVER`
3. `anchor build` again
4. `anchor deploy`

## Day 2 todo

- TypeScript SDK wrapping all instructions
- Helius webhook indexer (Postgres)
- Attestor relay service