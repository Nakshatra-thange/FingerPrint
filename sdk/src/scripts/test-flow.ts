/**
 * Fingerprint — End-to-end flow test
 * Run with: ts-node scripts/test-flow.ts
 *
 * Tests the complete happy path + dispute path entirely through the SDK,
 * against a running localnet (anchor localnet) or devnet.
 *
 * No UI. No manual steps. One script, full coverage.
 */

import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
  } from "@solana/web3.js";
  import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
  import { createSDKFromKeypair, FingerprintSDK } from "../index";
  import * as assert from "assert";
  
  // ── IDLs ─────────────────────────────────────────────────────────────────────
  const escrowIdl = require("../../target/idl/escrow.json");
  const attestationIdl = require("../../target/idl/attestation.json");
  const disputeIdl = require("../../target/idl/dispute.json");
  
  // ── Config ────────────────────────────────────────────────────────────────────
  const RPC_URL = process.env.SOLANA_RPC_URL ?? "http://localhost:8899";
  const connection = new Connection(RPC_URL, "confirmed");
  
  // ── Actors ────────────────────────────────────────────────────────────────────
  const payer = Keypair.generate();
  const receiver = Keypair.generate();
  const attestors = Array.from({ length: 5 }, () => Keypair.generate());
  const resolver = Keypair.generate(); // would be multisig in prod
  
  // ── Helpers ───────────────────────────────────────────────────────────────────
  
  async function airdrop(pubkey: PublicKey, sol = 10) {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...latestBlockhash });
  }
  
  function sdkFor(keypair: Keypair): FingerprintSDK {
    return createSDKFromKeypair(keypair, RPC_URL, {
      escrow: escrowIdl,
      attestation: attestationIdl,
      dispute: disputeIdl,
    });
  }
  
  function log(section: string, msg: string) {
    console.log(`\n  [${section}] ${msg}`);
  }
  
  function pass(msg: string) {
    console.log(`  ✓  ${msg}`);
  }
  
  function heading(title: string) {
    console.log(`\n${"─".repeat(60)}\n  ${title}\n${"─".repeat(60)}`);
  }
  
  // ── Sleep for localnet time advancement ───────────────────────────────────────
  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  // ── Test suite ────────────────────────────────────────────────────────────────
  
  async function main() {
    console.log("\n══════════════════════════════════════════════════════════");
    console.log("  Fingerprint SDK — End-to-End Flow Test");
    console.log(`  RPC: ${RPC_URL}`);
    console.log("══════════════════════════════════════════════════════════");
  
    // ── Fund all actors ──────────────────────────────────────────────────────
    heading("SETUP — Airdrop");
    console.log("  Funding actors...");
    await Promise.all([
      airdrop(payer.publicKey, 20),
      airdrop(receiver.publicKey, 2),
      airdrop(resolver.publicKey, 2),
      ...attestors.map((a) => airdrop(a.publicKey, 2)),
    ]);
    pass(`Payer:    ${payer.publicKey.toBase58()}`);
    pass(`Receiver: ${receiver.publicKey.toBase58()}`);
    pass(`Attestors funded: ${attestors.length}`);
  
    const payerSDK = sdkFor(payer);
  
    // ════════════════════════════════════════════════════════
    // TEST 1 — Happy path: lock → attest × 3 → auto-release
    // ════════════════════════════════════════════════════════
  
    heading("TEST 1 — Happy Path (3-of-5 threshold, auto-release)");
  
    const ESCROW_ID_1 = BigInt(Date.now()); // unique per run
    const AMOUNT = BigInt(LAMPORTS_PER_SOL); // 1 SOL
    const THRESHOLD = 3;
    const SHORT_DISPUTE_WINDOW = 3; // 3 seconds — so we can test auto-release fast
  
    // 1a. Create escrow + init registry
    log("1a", "Creating escrow...");
    const deadlineUnix = Math.floor(Date.now() / 1000) + 7 * 86400;
  
    const { signature: createSig, escrowPubkey, registryPubkey } =
      await payerSDK.setupEscrow({
        escrowId: ESCROW_ID_1,
        eventDescription: "Truck TN-07 delivers 200 bags of wheat to warehouse W12",
        requiredAttestors: attestors.map((a) => a.publicKey),
        threshold: THRESHOLD,
        amountLamports: AMOUNT,
        deadlineUnix,
        disputeWindowSeconds: SHORT_DISPUTE_WINDOW,
        receiver: receiver.publicKey,
      });
  
    pass(`createEscrow + initRegistry: ${createSig.slice(0, 20)}...`);
    pass(`Escrow PDA: ${escrowPubkey.toBase58()}`);
  
    // 1b. Verify on-chain state
    const escrow1 = await payerSDK.escrow.fetchEscrow(ESCROW_ID_1);
    assert.strictEqual(escrow1.eventDescription, "Truck TN-07 delivers 200 bags of wheat to warehouse W12");
    assert.strictEqual(escrow1.threshold, THRESHOLD);
    assert.deepStrictEqual(Object.keys(escrow1.status), ["active"]);
    pass("Escrow account: status=active, threshold=3");
  
    const vaultBalance1 = await payerSDK.escrow.fetchVaultBalance(ESCROW_ID_1);
    assert.strictEqual(vaultBalance1, Number(AMOUNT));
    pass(`Vault balance: ${vaultBalance1 / LAMPORTS_PER_SOL} SOL ✓`);
  
    // 1c. Submit attestations one by one
    log("1c", "Submitting attestations (3 of 5)...");
  
    for (let i = 0; i < THRESHOLD; i++) {
      const attestorSDK = sdkFor(attestors[i]);
      const evidenceCid =
        i === 0
          ? "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
          : undefined;
  
      const sig = await attestorSDK.attestation.submitAttestation({
        escrowId: ESCROW_ID_1,
        attestor: attestors[i].publicKey,
        evidenceCid,
      });
  
      const registry = await payerSDK.attestation.fetchRegistry(ESCROW_ID_1);
      pass(
        `Attestor ${i + 1} submitted (${registry.attestationCount}/${THRESHOLD}) tx=${sig.slice(0, 16)}...`
      );
    }
  
    // 1d. Verify threshold was met via CPI
    const escrow1AfterThreshold = await payerSDK.escrow.fetchEscrow(ESCROW_ID_1);
    assert.deepStrictEqual(Object.keys(escrow1AfterThreshold.status), ["thresholdMet"]);
    assert.ok(escrow1AfterThreshold.thresholdMetAt !== null);
    pass("Escrow status: thresholdMet ✓  (CPI from attestation → escrow worked)");
  
    const registry1 = await payerSDK.attestation.fetchRegistry(ESCROW_ID_1);
    assert.strictEqual(registry1.thresholdReached, true);
    pass("Registry: thresholdReached=true ✓");
  
    // 1e. Verify attestation status map
    const statusMap = await payerSDK.attestation.getAttestationStatus(
      ESCROW_ID_1,
      attestors.map((a) => a.publicKey)
    );
    let attestedCount = 0;
    statusMap.forEach((v) => { if (v) attestedCount++; });
    assert.strictEqual(attestedCount, THRESHOLD);
    pass(`Attestation map: ${attestedCount}/5 attested ✓`);
  
    // 1f. Verify release is blocked during dispute window
    log("1f", "Verifying release is blocked during dispute window...");
    try {
      await payerSDK.escrow.releaseFunds(ESCROW_ID_1, receiver.publicKey);
      throw new Error("Should have failed");
    } catch (e: any) {
      assert.ok(
        e.message.includes("DisputeWindowActive") || e.message.includes("custom program error"),
        `Expected DisputeWindowActive, got: ${e.message}`
      );
      pass("releaseFunds correctly blocked within dispute window ✓");
    }
  
    // 1g. Wait for dispute window to pass (SHORT_DISPUTE_WINDOW + 2s buffer)
    log("1g", `Waiting ${SHORT_DISPUTE_WINDOW + 2}s for dispute window to close...`);
    await sleep((SHORT_DISPUTE_WINDOW + 2) * 1000);
  
    // 1h. Auto-release (anyone can call — using receiver's SDK here)
    const receiverSDK = sdkFor(receiver);
    const releaseSig = await receiverSDK.escrow.releaseFunds(
      ESCROW_ID_1,
      receiver.publicKey
    );
    pass(`releaseFunds tx: ${releaseSig.slice(0, 20)}...`);
  
    // 1i. Verify final state
    const escrow1Final = await payerSDK.escrow.fetchEscrow(ESCROW_ID_1);
    assert.deepStrictEqual(Object.keys(escrow1Final.status), ["released"]);
    pass("Escrow status: released ✓");
  
    const vaultBalanceFinal = await payerSDK.escrow.fetchVaultBalance(ESCROW_ID_1);
    assert.strictEqual(vaultBalanceFinal, 0);
    pass("Vault balance: 0 ✓ (funds transferred to receiver)");
  
    // fetchFullState smoke test
    const fullState = await payerSDK.fetchFullState(ESCROW_ID_1);
    assert.ok(fullState.escrow);
    assert.ok(fullState.registry);
    assert.ok(fullState.attestationMap.size > 0);
    pass("fetchFullState: all fields present ✓");
  
    // ════════════════════════════════════════════════════════
    // TEST 2 — Dispute path: lock → attest × 3 → dispute → resolve for payer
    // ════════════════════════════════════════════════════════
  
    heading("TEST 2 — Dispute Path (payer disputes, resolver refunds payer)");
  
    const ESCROW_ID_2 = BigInt(Date.now() + 1);
  
    log("2a", "Creating second escrow...");
    await payerSDK.setupEscrow({
      escrowId: ESCROW_ID_2,
      eventDescription: "Refrigerated truck FN-22 delivers 50 crates of mangoes to market M3",
      requiredAttestors: attestors.map((a) => a.publicKey),
      threshold: THRESHOLD,
      amountLamports: AMOUNT,
      deadlineUnix: Math.floor(Date.now() / 1000) + 7 * 86400,
      disputeWindowSeconds: 86400, // 24h — payer disputes before it closes
      receiver: receiver.publicKey,
    });
    pass("Escrow 2 created");
  
    // Submit 3 attestations
    log("2b", "Submitting attestations...");
    for (let i = 0; i < THRESHOLD; i++) {
      await sdkFor(attestors[i]).attestation.submitAttestation({
        escrowId: ESCROW_ID_2,
        attestor: attestors[i].publicKey,
      });
    }
    pass("3/5 attestations submitted, threshold met");
  
    // Payer opens dispute immediately (within 24h window)
    log("2c", "Payer opens dispute...");
    const { signature: disputeSig, disputePubkey } = await payerSDK.dispute.openDispute({
      escrowId: ESCROW_ID_2,
      reason: "Delivery was incomplete — only 30 crates arrived, not 50",
      counterEvidenceCid: "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354",
    });
    pass(`openDispute tx: ${disputeSig.slice(0, 20)}...`);
  
    // Verify escrow is frozen
    const escrow2Disputed = await payerSDK.escrow.fetchEscrow(ESCROW_ID_2);
    assert.deepStrictEqual(Object.keys(escrow2Disputed.status), ["disputed"]);
    pass("Escrow status: disputed ✓ (frozen by dispute program CPI)");
  
    // Verify dispute record
    const disputeRecord = await payerSDK.dispute.fetchDispute(ESCROW_ID_2);
    assert.ok(disputeRecord !== null);
    assert.deepStrictEqual(Object.keys(disputeRecord!.status), ["open"]);
    assert.ok(disputeRecord!.reason.includes("30 crates"));
    pass("Dispute record: status=open, reason stored ✓");
  
    // Release is now blocked even after window would close (status=disputed, not thresholdMet)
    log("2d", "Verifying disputed escrow cannot be auto-released...");
    try {
      await receiverSDK.escrow.releaseFunds(ESCROW_ID_2, receiver.publicKey);
      throw new Error("Should have failed");
    } catch (e: any) {
      assert.ok(
        e.message.includes("InvalidStatus") || e.message.includes("custom program error"),
        `Expected InvalidStatus, got: ${e.message}`
      );
      pass("releaseFunds blocked on disputed escrow ✓");
    }
  
    // Resolver decides: refund payer (dispute upheld)
    log("2e", "Resolver resolves dispute in favour of payer...");
    const resolverSDK = sdkFor(resolver);
    const resolveSig = await resolverSDK.dispute.resolveDispute({
      escrowId: ESCROW_ID_2,
      releaseToReceiver: false,
      resolverNotes: "Evidence confirms only partial delivery. Refunding payer.",
    });
    pass(`resolveDispute tx: ${resolveSig.slice(0, 20)}...`);
  
    const escrow2Resolved = await payerSDK.escrow.fetchEscrow(ESCROW_ID_2);
    assert.deepStrictEqual(Object.keys(escrow2Resolved.status), ["refunded"]);
    pass("Escrow status: refunded ✓");
  
    const vault2Balance = await payerSDK.escrow.fetchVaultBalance(ESCROW_ID_2);
    assert.strictEqual(vault2Balance, 0);
    pass("Vault balance: 0 ✓ (funds returned to payer)");
  
    // ════════════════════════════════════════════════════════
    // TEST 3 — Edge cases
    // ════════════════════════════════════════════════════════
  
    heading("TEST 3 — Edge Cases");
  
    // 3a. Unauthorised attestor rejected
    log("3a", "Unauthorised attestor should be rejected...");
    const ESCROW_ID_3 = BigInt(Date.now() + 2);
    const stranger = Keypair.generate();
    await airdrop(stranger.publicKey, 2);
  
    await payerSDK.setupEscrow({
      escrowId: ESCROW_ID_3,
      eventDescription: "Edge case test escrow",
      requiredAttestors: attestors.map((a) => a.publicKey),
      threshold: THRESHOLD,
      amountLamports: AMOUNT,
      deadlineUnix: Math.floor(Date.now() / 1000) + 86400,
      disputeWindowSeconds: 86400,
      receiver: receiver.publicKey,
    });
  
    try {
      await sdkFor(stranger).attestation.submitAttestation({
        escrowId: ESCROW_ID_3,
        attestor: stranger.publicKey,
      });
      throw new Error("Should have been rejected");
    } catch (e: any) {
      assert.ok(
        e.message.includes("NotAuthorizedAttestor") || e.message.includes("custom program error"),
        `Expected NotAuthorizedAttestor, got: ${e.message}`
      );
      pass("Unauthorised attestor rejected ✓");
    }
  
    // 3b. Double attestation rejected
    log("3b", "Double attestation should be rejected...");
    await sdkFor(attestors[0]).attestation.submitAttestation({
      escrowId: ESCROW_ID_3,
      attestor: attestors[0].publicKey,
    });
  
    try {
      await sdkFor(attestors[0]).attestation.submitAttestation({
        escrowId: ESCROW_ID_3,
        attestor: attestors[0].publicKey,
      });
      throw new Error("Should have been rejected");
    } catch (e: any) {
      assert.ok(
        e.message.includes("AlreadyAttested") || e.message.includes("custom program error"),
        `Expected AlreadyAttested, got: ${e.message}`
      );
      pass("Double attestation rejected ✓");
    }
  
    // 3c. Non-payer cannot open dispute
    log("3c", "Non-payer trying to open dispute should be rejected...");
    // First get escrow 3 to threshold
    for (let i = 1; i < THRESHOLD; i++) {
      await sdkFor(attestors[i]).attestation.submitAttestation({
        escrowId: ESCROW_ID_3,
        attestor: attestors[i].publicKey,
      });
    }
  
    try {
      await receiverSDK.dispute.openDispute({
        escrowId: ESCROW_ID_3,
        reason: "Receiver trying to dispute — should not be allowed",
      });
      throw new Error("Should have been rejected");
    } catch (e: any) {
      assert.ok(
        e.message.includes("OnlyPayerCanDispute") || e.message.includes("custom program error"),
        `Expected OnlyPayerCanDispute, got: ${e.message}`
      );
      pass("Non-payer dispute rejected ✓");
    }
  
    // ── Final summary ─────────────────────────────────────────────────────────
  
    console.log("\n══════════════════════════════════════════════════════════");
    console.log("  ALL TESTS PASSED");
    console.log("  Test 1: Happy path (lock → attest × 3 → auto-release)  ✓");
    console.log("  Test 2: Dispute path (dispute → resolver → refund)      ✓");
    console.log("  Test 3: Edge cases (unauth / double / non-payer)        ✓");
    console.log("══════════════════════════════════════════════════════════\n");
  }
  
  main().catch((err) => {
    console.error("\n✗  Test failed:", err.message ?? err);
    process.exit(1);
  });