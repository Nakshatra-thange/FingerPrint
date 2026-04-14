"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttestationClient = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@coral-xyz/anchor");
const pda_1 = require("./pda");
const constants_1 = require("./constants");
const idl_1 = require("./idl");
class AttestationClient {
    constructor(provider, idl) {
        this.provider = provider;
        this.program = new anchor_1.Program((0, idl_1.normalizeIdl)(idl), constants_1.ATTESTATION_PROGRAM_ID, provider);
    }
    // ── Instructions ────────────────────────────────────────────────────────────
    /**
     * Payer initialises the attestor registry right after creating the escrow.
     * Must be called before any attestor can submit.
     */
    async initRegistry(escrowId) {
        const [escrowPubkey] = (0, pda_1.deriveEscrowPDA)(escrowId);
        const [registryPubkey] = (0, pda_1.deriveRegistryPDA)(escrowId);
        const signature = await this.program.methods
            .initRegistry(new anchor_1.BN(escrowId.toString()))
            .accounts({
            attestorRegistry: registryPubkey,
            escrowAccount: escrowPubkey,
            payer: this.provider.wallet.publicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        return { signature, registryPubkey };
    }
    /**
     * An authorised attestor submits their signed attestation.
     * Optionally attaches an IPFS CID as evidence.
     * If this attestation hits the threshold, automatically CPIs into escrow.
     */
    async submitAttestation(params) {
        const { escrowId, attestor, evidenceCid } = params;
        const [escrowPubkey] = (0, pda_1.deriveEscrowPDA)(escrowId);
        const [registryPubkey] = (0, pda_1.deriveRegistryPDA)(escrowId);
        const [recordPubkey] = (0, pda_1.deriveAttestationRecordPDA)(escrowId, attestor);
        return this.program.methods
            .submitAttestation(new anchor_1.BN(escrowId.toString()), evidenceCid ?? null)
            .accounts({
            attestorRegistry: registryPubkey,
            attestationRecord: recordPubkey,
            escrowAccount: escrowPubkey,
            attestor,
            escrowProgram: constants_1.ESCROW_PROGRAM_ID,
            attestationSelf: constants_1.ATTESTATION_PROGRAM_ID,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
    }
    // ── Reads ────────────────────────────────────────────────────────────────────
    async fetchRegistry(escrowId) {
        const [registryPubkey] = (0, pda_1.deriveRegistryPDA)(escrowId);
        return this.program.account["attestorRegistry"].fetch(registryPubkey);
    }
    async fetchAttestationRecord(escrowId, attestor) {
        const [recordPubkey] = (0, pda_1.deriveAttestationRecordPDA)(escrowId, attestor);
        try {
            return (await this.program.account["attestationRecord"].fetch(recordPubkey));
        }
        catch {
            return null;
        }
    }
    /**
     * Returns a map of attestor → has attested for all required attestors.
     */
    async getAttestationStatus(escrowId, requiredAttestors) {
        const results = new Map();
        await Promise.all(requiredAttestors.map(async (attestor) => {
            const record = await this.fetchAttestationRecord(escrowId, attestor);
            results.set(attestor.toBase58(), record?.attested ?? false);
        }));
        return results;
    }
    getRegistryPubkey(escrowId) {
        return (0, pda_1.deriveRegistryPDA)(escrowId)[0];
    }
    getRecordPubkey(escrowId, attestor) {
        return (0, pda_1.deriveAttestationRecordPDA)(escrowId, attestor)[0];
    }
}
exports.AttestationClient = AttestationClient;
