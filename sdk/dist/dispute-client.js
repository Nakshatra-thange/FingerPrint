"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisputeClient = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@coral-xyz/anchor");
const pda_1 = require("./pda");
const constants_1 = require("./constants");
const idl_1 = require("./idl");
class DisputeClient {
    constructor(provider, idl, escrowIdl) {
        this.provider = provider;
        this.escrowIdl = escrowIdl;
        this.program = new anchor_1.Program((0, idl_1.normalizeIdl)(idl), constants_1.DISPUTE_PROGRAM_ID, provider);
    }
    // ── Instructions ────────────────────────────────────────────────────────────
    /**
     * Payer opens a dispute within the dispute window.
     * Freezes the escrow — auto-release is blocked until resolved.
     */
    async openDispute(params) {
        const { escrowId, reason, counterEvidenceCid } = params;
        const [escrowPubkey] = (0, pda_1.deriveEscrowPDA)(escrowId);
        const [disputePubkey] = (0, pda_1.deriveDisputePDA)(escrowId);
        const signature = await this.program.methods
            .openDispute(new anchor_1.BN(escrowId.toString()), reason, counterEvidenceCid ?? null)
            .accounts({
            disputeRecord: disputePubkey,
            escrowAccount: escrowPubkey,
            disputer: this.provider.wallet.publicKey,
            escrowProgram: constants_1.ESCROW_PROGRAM_ID,
            disputeSelf: constants_1.DISPUTE_PROGRAM_ID,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        return { signature, disputePubkey };
    }
    /**
     * Resolver (multisig / DAO) decides the outcome.
     * releaseToReceiver = true  → receiver gets paid (attestations valid)
     * releaseToReceiver = false → payer refunded (dispute upheld)
     */
    async resolveDispute(params) {
        const { escrowId, releaseToReceiver, resolverNotes } = params;
        const escrow = await this.fetchEscrowForDispute(escrowId);
        const [escrowPubkey] = (0, pda_1.deriveEscrowPDA)(escrowId);
        const [vaultPubkey] = (0, pda_1.deriveVaultPDA)(escrowId);
        const [disputePubkey] = (0, pda_1.deriveDisputePDA)(escrowId);
        return this.program.methods
            .resolveDispute(new anchor_1.BN(escrowId.toString()), releaseToReceiver, resolverNotes ?? null)
            .accounts({
            disputeRecord: disputePubkey,
            escrowAccount: escrowPubkey,
            escrowVault: vaultPubkey,
            receiver: escrow.receiver,
            payerAccount: escrow.payer,
            resolver: this.provider.wallet.publicKey,
            escrowProgram: constants_1.ESCROW_PROGRAM_ID,
            disputeSelf: constants_1.DISPUTE_PROGRAM_ID,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
    }
    // ── Reads ────────────────────────────────────────────────────────────────────
    async fetchDispute(escrowId) {
        const [disputePubkey] = (0, pda_1.deriveDisputePDA)(escrowId);
        try {
            return (await this.program.account["disputeRecord"].fetch(disputePubkey));
        }
        catch {
            return null;
        }
    }
    getDisputePubkey(escrowId) {
        return (0, pda_1.deriveDisputePDA)(escrowId)[0];
    }
    // ── Private helpers ──────────────────────────────────────────────────────────
    async fetchEscrowForDispute(escrowId) {
        const [escrowPubkey] = (0, pda_1.deriveEscrowPDA)(escrowId);
        const raw = await this.program.provider.connection.getAccountInfo(escrowPubkey);
        if (!raw)
            throw new Error(`Escrow ${escrowId} not found`);
        // Decode using Anchor's coder — program has escrow IDL via CPI dependency
        // In practice the indexer supplies this; here we read direct from chain
        const escrowProgram = new anchor_1.Program((0, idl_1.normalizeIdl)(this.escrowIdl), constants_1.ESCROW_PROGRAM_ID, this.provider);
        return escrowProgram.account["escrowAccount"].fetch(escrowPubkey);
    }
}
exports.DisputeClient = DisputeClient;
