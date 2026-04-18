"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisputeClient = exports.AttestationClient = exports.EscrowClient = exports.FingerprintSDK = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const escrow_client_1 = require("./escrow-client");
const attestation_client_1 = require("./attestation-client");
const dispute_client_1 = require("./dispute-client");
const constants_1 = require("./constants");
const pda_1 = require("./pda");
class FingerprintSDK {
    constructor(config) {
        this.provider = new anchor_1.AnchorProvider(config.connection, config.wallet, {
            commitment: "confirmed",
        });
        this.escrow = new escrow_client_1.EscrowClient(this.provider, config.escrowIdl);
        this.attestation = new attestation_client_1.AttestationClient(this.provider, config.attestationIdl);
        this.dispute = new dispute_client_1.DisputeClient(this.provider, config.disputeIdl, config.escrowIdl);
    }
    async setupEscrow(params) {
        const result = await this.escrow.createEscrow(params);
        const registryResult = await this.attestation.initRegistry(params.escrowId);
        return {
            ...result,
            registryPubkey: registryResult.registryPubkey,
            registrySignature: registryResult.signature,
        };
    }
    async fetchFullState(escrowId) {
        const escrow = await this.escrow.fetchEscrow(escrowId);
        const registry = await this.attestation.fetchRegistry(escrowId);
        const vaultBalance = await this.escrow.fetchVaultBalance(escrowId);
        const attestationMap = await this.attestation.getAttestationStatus(escrowId, registry.requiredAttestors);
        const dispute = await this.dispute.fetchDispute(escrowId);
        return { escrow, registry, vaultBalance, attestationMap, dispute };
    }
}
exports.FingerprintSDK = FingerprintSDK;
FingerprintSDK.pda = {
    escrow: pda_1.deriveEscrowPDA,
    vault: pda_1.deriveVaultPDA,
    registry: pda_1.deriveRegistryPDA,
    attestationRecord: pda_1.deriveAttestationRecordPDA,
    dispute: pda_1.deriveDisputePDA,
};
FingerprintSDK.programIds = {
    escrow: constants_1.ESCROW_PROGRAM_ID,
    attestation: constants_1.ATTESTATION_PROGRAM_ID,
    dispute: constants_1.DISPUTE_PROGRAM_ID,
};
var escrow_client_2 = require("./escrow-client");
Object.defineProperty(exports, "EscrowClient", { enumerable: true, get: function () { return escrow_client_2.EscrowClient; } });
var attestation_client_2 = require("./attestation-client");
Object.defineProperty(exports, "AttestationClient", { enumerable: true, get: function () { return attestation_client_2.AttestationClient; } });
var dispute_client_2 = require("./dispute-client");
Object.defineProperty(exports, "DisputeClient", { enumerable: true, get: function () { return dispute_client_2.DisputeClient; } });
__exportStar(require("./types"), exports);
__exportStar(require("./pda"), exports);
__exportStar(require("./constants"), exports);
__exportStar(require("./idl"), exports);
