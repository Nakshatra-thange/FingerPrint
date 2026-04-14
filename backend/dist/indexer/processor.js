"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventProcessor = void 0;
const queries_1 = require("../db/queries");
const sdk_1 = require("@fingerprint/sdk");
class EventProcessor {
    constructor(sdk) {
        this.sdk = sdk;
    }
    /**
     * Dispatch a single parsed event to the correct handler.
     * Logs to webhook_events first, processes, then marks done.
     */
    async processEvent(event) {
        const logId = await (0, queries_1.logWebhookEvent)(event.type, event);
        try {
            switch (event.type) {
                case "EscrowCreated":
                    await this.handleEscrowCreated(event);
                    break;
                case "AttestationSubmitted":
                    await this.handleAttestationSubmitted(event);
                    break;
                case "ThresholdMet":
                    await this.handleThresholdMet(event);
                    break;
                case "FundsReleased":
                    await this.handleFundsReleased(event);
                    break;
                case "FundsRefunded":
                    await this.handleFundsRefunded(event);
                    break;
                case "EscrowFrozen":
                    await this.handleEscrowFrozen(event);
                    break;
                case "DisputeOpened":
                    await this.handleDisputeOpened(event);
                    break;
                case "DisputeResolvedOnChain":
                    await this.handleDisputeResolved(event);
                    break;
                // RegistryInitialised / ThresholdReached are informational — no DB write needed
                default:
                    break;
            }
            await (0, queries_1.markWebhookProcessed)(logId);
        }
        catch (err) {
            await (0, queries_1.markWebhookProcessed)(logId, err.message ?? String(err));
            console.error(`Error processing event ${event.type}:`, err);
            // Don't rethrow — we log and continue
        }
    }
    async processEvents(events) {
        for (const event of events) {
            await this.processEvent(event);
        }
    }
    // ── Handlers ─────────────────────────────────────────────────────────────────
    async handleEscrowCreated(event) {
        const escrowId = BigInt(event.escrowId);
        const [escrowPubkey] = (0, sdk_1.deriveEscrowPDA)(escrowId);
        const [vaultPubkey] = (0, sdk_1.deriveVaultPDA)(escrowId);
        // Fetch full account to get all fields (description, attestors, etc.)
        const onChain = await this.sdk.escrow.fetchEscrow(escrowId);
        await (0, queries_1.upsertEscrow)({
            escrow_id: event.escrowId,
            escrow_pubkey: escrowPubkey.toBase58(),
            vault_pubkey: vaultPubkey.toBase58(),
            payer: event.payer,
            receiver: event.receiver,
            event_description: onChain.eventDescription,
            required_attestors: onChain.requiredAttestors.map((p) => p.toBase58()),
            threshold: onChain.threshold,
            amount_lamports: event.amount,
            deadline_unix: event.deadline,
            dispute_window_seconds: onChain.disputeWindowSeconds.toString(),
            status: "active",
            threshold_met_at: null,
            created_at: onChain.createdAt.toString(),
        });
        console.log(`[indexer] EscrowCreated: id=${event.escrowId} payer=${event.payer}`);
    }
    async handleAttestationSubmitted(event) {
        const escrowId = BigInt(event.escrowId);
        const { PublicKey } = require("@solana/web3.js");
        const { deriveAttestationRecordPDA } = require("@fingerprint/sdk");
        const [recordPubkey] = deriveAttestationRecordPDA(escrowId, new PublicKey(event.attestor));
        await (0, queries_1.insertAttestation)({
            escrow_id: event.escrowId,
            attestor: event.attestor,
            record_pubkey: recordPubkey.toBase58(),
            evidence_cid: event.evidenceCid,
            timestamp_unix: event.blockTime.toString(),
            tx_signature: event.signature,
        });
        console.log(`[indexer] AttestationSubmitted: escrow=${event.escrowId} attestor=${event.attestor} count=${event.count}/${event.threshold}`);
    }
    async handleThresholdMet(event) {
        await (0, queries_1.updateEscrowStatus)(event.escrowId, "thresholdMet", event.timestamp);
        console.log(`[indexer] ThresholdMet: escrow=${event.escrowId}`);
    }
    async handleFundsReleased(event) {
        await (0, queries_1.updateEscrowStatus)(event.escrowId, "released");
        console.log(`[indexer] FundsReleased: escrow=${event.escrowId} to=${event.receiver}`);
    }
    async handleFundsRefunded(event) {
        await (0, queries_1.updateEscrowStatus)(event.escrowId, "refunded");
        console.log(`[indexer] FundsRefunded: escrow=${event.escrowId} to=${event.payer}`);
    }
    async handleEscrowFrozen(event) {
        await (0, queries_1.updateEscrowStatus)(event.escrowId, "disputed");
        console.log(`[indexer] EscrowFrozen: escrow=${event.escrowId}`);
    }
    async handleDisputeOpened(event) {
        const escrowId = BigInt(event.escrowId);
        const [disputePubkey] = (0, sdk_1.deriveDisputePDA)(escrowId);
        await (0, queries_1.upsertDispute)({
            escrow_id: event.escrowId,
            dispute_pubkey: disputePubkey.toBase58(),
            disputer: event.disputer,
            reason: event.reason,
            counter_evidence_cid: event.counterEvidenceCid,
            status: "open",
            opened_at_unix: event.blockTime.toString(),
            resolved_at_unix: null,
            resolver_notes: null,
            tx_signature: event.signature,
        });
        console.log(`[indexer] DisputeOpened: escrow=${event.escrowId} disputer=${event.disputer}`);
    }
    async handleDisputeResolved(event) {
        const finalStatus = event.releaseToReceiver
            ? "resolvedForReceiver"
            : "resolvedForPayer";
        await (0, queries_1.upsertDispute)({
            escrow_id: event.escrowId,
            dispute_pubkey: "", // already exists in DB
            disputer: "",
            reason: "",
            counter_evidence_cid: null,
            status: finalStatus,
            opened_at_unix: "0",
            resolved_at_unix: event.blockTime.toString(),
            resolver_notes: event.resolverNotes,
            tx_signature: event.signature,
        });
        await (0, queries_1.updateEscrowStatus)(event.escrowId, event.releaseToReceiver ? "released" : "refunded");
        console.log(`[indexer] DisputeResolved: escrow=${event.escrowId} releaseToReceiver=${event.releaseToReceiver}`);
    }
}
exports.EventProcessor = EventProcessor;
