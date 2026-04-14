"use strict";
/**
 * Helius sends "enhanced transaction" webhooks.
 * We parse the logs to extract our program's emitted events.
 *
 * Anchor events are emitted as base64-encoded borsh in the tx logs:
 *   "Program log: <base64>"
 * The discriminator (first 8 bytes of sha256("event:<EventName>")) identifies the type.
 *
 * In production: use Anchor's EventParser from @coral-xyz/anchor.
 * Here we implement a clean parser that works with Helius's payload shape.
 */
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventParser = void 0;
const anchor = __importStar(require("@coral-xyz/anchor"));
const sdk_1 = require("@fingerprint/sdk");
// ── Parser ────────────────────────────────────────────────────────────────────
class EventParser {
    constructor(escrowIdl, attestationIdl, disputeIdl) {
        this.escrowParser = new anchor.EventParser(sdk_1.ESCROW_PROGRAM_ID, new anchor.BorshCoder(escrowIdl));
        this.attestationParser = new anchor.EventParser(sdk_1.ATTESTATION_PROGRAM_ID, new anchor.BorshCoder(attestationIdl));
        this.disputeParser = new anchor.EventParser(sdk_1.DISPUTE_PROGRAM_ID, new anchor.BorshCoder(disputeIdl));
    }
    /**
     * Parse all events from a Helius transaction payload.
     * Returns a flat array of typed ParsedEvent objects.
     */
    parseTransaction(tx) {
        const events = [];
        const meta = { signature: tx.signature, slot: tx.slot, blockTime: tx.timestamp };
        // Escrow program events
        for (const event of this.escrowParser.parseLogs(tx.logs)) {
            const parsed = this.mapEscrowEvent(event, meta);
            if (parsed)
                events.push(parsed);
        }
        // Attestation program events
        for (const event of this.attestationParser.parseLogs(tx.logs)) {
            const parsed = this.mapAttestationEvent(event, meta);
            if (parsed)
                events.push(parsed);
        }
        // Dispute program events
        for (const event of this.disputeParser.parseLogs(tx.logs)) {
            const parsed = this.mapDisputeEvent(event, meta);
            if (parsed)
                events.push(parsed);
        }
        return events;
    }
    parseWebhookPayload(payload) {
        return payload.transactions.flatMap((tx) => this.parseTransaction(tx));
    }
    // ── Private mappers ──────────────────────────────────────────────────────────
    mapEscrowEvent(event, meta) {
        const base = { ...meta, programId: sdk_1.ESCROW_PROGRAM_ID.toBase58() };
        switch (event.name) {
            case "EscrowCreated":
                return {
                    type: "EscrowCreated",
                    ...base,
                    escrowId: event.data.escrowId.toString(),
                    payer: event.data.payer.toBase58(),
                    receiver: event.data.receiver.toBase58(),
                    amount: event.data.amount.toString(),
                    threshold: event.data.threshold,
                    deadline: event.data.deadline.toString(),
                };
            case "ThresholdMet":
                return {
                    type: "ThresholdMet",
                    ...base,
                    escrowId: event.data.escrowId.toString(),
                    timestamp: event.data.timestamp.toString(),
                };
            case "FundsReleased":
                return {
                    type: "FundsReleased",
                    ...base,
                    escrowId: event.data.escrowId.toString(),
                    receiver: event.data.receiver.toBase58(),
                    amount: event.data.amount.toString(),
                };
            case "FundsRefunded":
                return {
                    type: "FundsRefunded",
                    ...base,
                    escrowId: event.data.escrowId.toString(),
                    payer: event.data.payer.toBase58(),
                    amount: event.data.amount.toString(),
                };
            case "EscrowFrozen":
                return {
                    type: "EscrowFrozen",
                    ...base,
                    escrowId: event.data.escrowId.toString(),
                    timestamp: event.data.timestamp.toString(),
                };
            case "DisputeResolved":
                return {
                    type: "DisputeResolved",
                    ...base,
                    escrowId: event.data.escrowId.toString(),
                    releaseToReceiver: event.data.releaseToReceiver,
                };
            default:
                return null;
        }
    }
    mapAttestationEvent(event, meta) {
        const base = { ...meta, programId: sdk_1.ATTESTATION_PROGRAM_ID.toBase58() };
        switch (event.name) {
            case "AttestationSubmitted":
                return {
                    type: "AttestationSubmitted",
                    ...base,
                    escrowId: event.data.escrowId.toString(),
                    attestor: event.data.attestor.toBase58(),
                    count: event.data.count,
                    threshold: event.data.threshold,
                    evidenceCid: event.data.evidenceCid ?? null,
                };
            case "RegistryInitialised":
                return {
                    type: "RegistryInitialised",
                    ...base,
                    escrowId: event.data.escrowId.toString(),
                    attestors: event.data.attestors.map((p) => p.toBase58()),
                    threshold: event.data.threshold,
                };
            case "ThresholdReached":
                return {
                    type: "ThresholdReached",
                    ...base,
                    escrowId: event.data.escrowId.toString(),
                    count: event.data.count,
                };
            default:
                return null;
        }
    }
    mapDisputeEvent(event, meta) {
        const base = { ...meta, programId: sdk_1.DISPUTE_PROGRAM_ID.toBase58() };
        switch (event.name) {
            case "DisputeOpened":
                return {
                    type: "DisputeOpened",
                    ...base,
                    escrowId: event.data.escrowId.toString(),
                    disputer: event.data.disputer.toBase58(),
                    reason: event.data.reason,
                    counterEvidenceCid: event.data.counterEvidenceCid ?? null,
                };
            case "DisputeResolved":
                return {
                    type: "DisputeResolvedOnChain",
                    ...base,
                    escrowId: event.data.escrowId.toString(),
                    releaseToReceiver: event.data.releaseToReceiver,
                    resolverNotes: event.data.resolverNotes ?? null,
                };
            default:
                return null;
        }
    }
}
exports.EventParser = EventParser;
