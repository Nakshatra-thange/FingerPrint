"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveEscrowPDA = deriveEscrowPDA;
exports.deriveVaultPDA = deriveVaultPDA;
exports.deriveRegistryPDA = deriveRegistryPDA;
exports.deriveAttestationRecordPDA = deriveAttestationRecordPDA;
exports.deriveDisputePDA = deriveDisputePDA;
const web3_js_1 = require("@solana/web3.js");
const constants_1 = require("./constants");
function escrowIdToBytes(escrowId) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(escrowId);
    return buf;
}
function deriveEscrowPDA(escrowId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constants_1.SEEDS.ESCROW), escrowIdToBytes(escrowId)], constants_1.ESCROW_PROGRAM_ID);
}
function deriveVaultPDA(escrowId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constants_1.SEEDS.VAULT), escrowIdToBytes(escrowId)], constants_1.ESCROW_PROGRAM_ID);
}
function deriveRegistryPDA(escrowId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constants_1.SEEDS.REGISTRY), escrowIdToBytes(escrowId)], constants_1.ATTESTATION_PROGRAM_ID);
}
function deriveAttestationRecordPDA(escrowId, attestor) {
    return web3_js_1.PublicKey.findProgramAddressSync([
        Buffer.from(constants_1.SEEDS.ATTESTATION),
        escrowIdToBytes(escrowId),
        attestor.toBuffer(),
    ], constants_1.ATTESTATION_PROGRAM_ID);
}
function deriveDisputePDA(escrowId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constants_1.SEEDS.DISPUTE), escrowIdToBytes(escrowId)], constants_1.DISPUTE_PROGRAM_ID);
}
