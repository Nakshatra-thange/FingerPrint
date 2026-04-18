"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscrowClient = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@coral-xyz/anchor");
const pda_1 = require("./pda");
const constants_1 = require("./constants");
const idl_1 = require("./idl");
class EscrowClient {
    constructor(provider, idl) {
        this.provider = provider;
        this.program = new anchor_1.Program((0, idl_1.normalizeIdl)(idl), constants_1.ESCROW_PROGRAM_ID, provider);
    }
    async createEscrow(params) {
        const { escrowId, eventDescription, requiredAttestors, threshold, amountLamports, deadlineUnix, disputeWindowSeconds = constants_1.DEFAULT_DISPUTE_WINDOW_SECONDS, receiver, } = params;
        const [escrowPubkey] = (0, pda_1.deriveEscrowPDA)(escrowId);
        const [vaultPubkey] = (0, pda_1.deriveVaultPDA)(escrowId);
        const signature = await this.program.methods
            .createEscrow(new anchor_1.BN(escrowId.toString()), eventDescription, requiredAttestors, threshold, new anchor_1.BN(amountLamports.toString()), new anchor_1.BN(deadlineUnix), new anchor_1.BN(disputeWindowSeconds))
            .accounts({
            escrowAccount: escrowPubkey,
            escrowVault: vaultPubkey,
            payer: this.provider.wallet.publicKey,
            receiver,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        return { signature, escrowPubkey, vaultPubkey };
    }
    async releaseFunds(escrowId, receiver) {
        const [escrowPubkey] = (0, pda_1.deriveEscrowPDA)(escrowId);
        const [vaultPubkey] = (0, pda_1.deriveVaultPDA)(escrowId);
        return this.program.methods
            .releaseFunds(new anchor_1.BN(escrowId.toString()))
            .accounts({
            escrowAccount: escrowPubkey,
            escrowVault: vaultPubkey,
            receiver,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
    }
    async refund(escrowId, payer) {
        const [escrowPubkey] = (0, pda_1.deriveEscrowPDA)(escrowId);
        const [vaultPubkey] = (0, pda_1.deriveVaultPDA)(escrowId);
        return this.program.methods
            .refund(new anchor_1.BN(escrowId.toString()))
            .accounts({
            escrowAccount: escrowPubkey,
            escrowVault: vaultPubkey,
            payerAccount: payer,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
    }
    async fetchEscrow(escrowId) {
        const [escrowPubkey] = (0, pda_1.deriveEscrowPDA)(escrowId);
        return this.program.account["escrowAccount"].fetch(escrowPubkey);
    }
    async fetchVaultBalance(escrowId) {
        const [vaultPubkey] = (0, pda_1.deriveVaultPDA)(escrowId);
        return this.provider.connection.getBalance(vaultPubkey);
    }
    getEscrowPubkey(escrowId) {
        return (0, pda_1.deriveEscrowPDA)(escrowId)[0];
    }
    getVaultPubkey(escrowId) {
        return (0, pda_1.deriveVaultPDA)(escrowId)[0];
    }
}
exports.EscrowClient = EscrowClient;
