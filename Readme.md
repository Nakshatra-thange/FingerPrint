# FingerPrint

A trustless escrow protocol on Solana. Lock funds, define who needs to confirm an event happened, and money moves automatically when enough people confirm it. No middlemen. No "call us to release payment." Just math and signatures.

---

## The problem it solves

Lets say a farmer sells wheat. Payment comes 3 weeks later through a broker who takes a cut and holds the money the whole time. A transporter delivers goods. Payment takes 45 days because someone needs to "process the invoice." A freelancer ships work. Payment is stuck waiting for one person to click approve.

In each case, the money is ready. The trust isn't.

FingerPrint replaces the middleman with a threshold signature check. Lock the money on-chain. Define 5 people who can confirm the event happened. When 3 of them sign, the dispute window opens. If nobody objects in 24 hours, funds release automatically. No one person controls anything.

---

## How it works

Three Solana programs talk to each other:

**escrow** — holds the money. Knows who paid, who receives, how much, and what the deadline is. Doesn't release anything until the attestation program tells it the threshold is met.

**attestation** — tracks signatures. Each allowed attestor gets one vote. When the count hits the threshold, it CPIs into the escrow program to flip the status. The attestation record PDA also acts as a deduplication guard — if you've already signed, the PDA exists and the transaction fails at the account init constraint. No double voting.

**dispute** — handles the 24-hour window. After threshold is met, anyone can open a dispute with a reason and evidence URI. This CPI's into escrow to mark it disputed. A resolver (currently a multisig key, can be upgraded to a DAO) decides the outcome.

---

## Escrow lifecycle

```
Created → Active → ThresholdMet → Released
                              ↘ Disputed → ResolvedForReceiver
                                         → ResolvedForPayer (Refunded)
         → Refunded (deadline passed without threshold)
```

Six states. Every transition is either permissionless (anyone can trigger release after window closes) or gated (only the correct program can flip status via CPI).

---

## Project structure

```
fingerprint/
├── programs/
│   ├── escrow/          — locks funds, manages lifecycle, handles releases
│   ├── attestation/     — registry + individual attestation records
│   └── dispute/         — dispute records, resolver logic
├── sdk/
│   └── src/
│       ├── escrow.ts        — build createEscrow / releaseFunds / refund txns
│       ├── attestation.ts   — build initRegistry / submitAttestation txns
│       ├── dispute.ts       — build openDispute / resolveDispute txns
│       ├── pdas.ts          — all PDA derivations in one place
│       └── types.ts         — TypeScript mirrors of on-chain account structs
└── tests/
    └── fingerprint.ts   — integration tests (mocha + chai)
```

---

## On-chain accounts

| Account | Seeds | Lives in |
|---|---|---|
| `EscrowAccount` | `["escrow", payer, nonce]` | escrow program |
| `vault` (token account) | `["vault", escrow]` | escrow program |
| `AttestorRegistry` | `["attestor_registry", escrow]` | attestation program |
| `AttestationRecord` | `["attestation_record", escrow, attestor]` | attestation program |
| `DisputeRecord` | `["dispute_record", escrow]` | dispute program |

The nonce in the escrow seed lets one payer create multiple escrows without collision.

The `AttestationRecord` PDA is the dedup guard. Trying to attest twice fails at `init` — the PDA already exists, Anchor throws before your instruction logic even runs.

---

## Getting started

**Prerequisites**

- Rust + Cargo
- Anchor CLI (`cargo install --git https://github.com/coral-xyz/anchor anchor-cli`)
- Solana CLI + a devnet keypair (`solana-keygen new`)
- Node.js 18+

**Setup**

```bash
git clone https://github.com/Nakshatra-thange/FingerPrint
cd fingerprint
yarn install
anchor build
```

**Deploy to devnet**

```bash
solana config set --url devnet
solana airdrop 2
anchor deploy
```

After deploy, copy the three program IDs printed in the terminal and update:
- `Anchor.toml` — under `[programs.devnet]`
- `programs/escrow/src/lib.rs` — `declare_id!` + `ATTESTATION_PROGRAM_ID` + `DISPUTE_PROGRAM_ID`
- `programs/attestation/src/lib.rs` — `declare_id!`
- `programs/dispute/src/lib.rs` — `declare_id!` + `RESOLVER_PUBKEY`
- `sdk/src/pdas.ts` — the three `PROGRAM_ID` constants

**Run tests**

```bash
anchor test
```

---

## Creating an escrow (SDK)

```typescript
import { EscrowClient } from "./sdk/src";
import BN from "bn.js";

const client = new EscrowClient(program, connection);

const tx = await client.buildCreateEscrow({
  payer:            wallet.publicKey,
  receiver:         receiverPubkey,
  tokenMint:        USDC_MINT,
  description:      "Truck TN-07 delivers 200 wheat bags to warehouse W12",
  allowedAttestors: [att1, att2, att3, att4, att5],
  threshold:        3,
  deadlineUnix:     Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
  amount:           new BN(5_000_000), // 5 USDC
  nonce:            new BN(1),
});

await sendAndConfirm(tx, [wallet]);
```

**Attestor signs**

```typescript
import { AttestationClient } from "./sdk/src";

const attestClient = new AttestationClient(program);

const tx = await attestClient.buildSubmitAttestation({
  attestor:    attestorWallet.publicKey,
  escrow:      escrowPda,
  evidenceUri: "ipfs://QmYourPhotoOrDocHash",
});

await sendAndConfirm(tx, [attestorWallet]);
```

Third signature → escrow flips to `ThresholdMet` automatically via CPI.

---

## Trust model

The only trust assumptions in this system:

1. **Attestors won't all collude.** If all 5 attestors are controlled by the receiver, they can attest falsely. That's why the payer picks the attestors — ideally independent parties (warehouse manager, logistics company, third-party inspector).

2. **The resolver is trusted for disputes.** Currently a single multisig key. The upgrade path is a token-weighted DAO vote. This is the weakest point in the system and we know it.

3. **The oracle problem isn't solved.** This protocol doesn't verify that the evidence URIs contain valid proof. That's a ZK attestation problem for a future version.

Everything else — fund custody, threshold counting, duplicate prevention, state transitions — is enforced by the programs. There's no admin key that can touch the vault.

---

## Upgrade path

What's currently a multisig resolver key can be replaced with a DAO program that accepts token-weighted votes. The `RESOLVER_PUBKEY` constant in `dispute/src/lib.rs` is the only thing that needs to change. The dispute program was written with this swap in mind.

ZK attestations are the longer-term play — instead of a human saying "yes this happened," a zero-knowledge proof attests to a signed document, a GPS coordinate, a sensor reading, without revealing the raw data. Same threshold logic, more trustless data.

---

## What's live

- Three programs on devnet
- TypeScript SDK for all instructions
- Integration tests covering the happy path, dedup guard, dispute flow, and refund path
- Frontend: coming in days 3–4

---

## Built with

- Rust + Anchor 0.29
- Solana web3.js + SPL Token
- TypeScript
- Helius (indexer, coming day 2)
