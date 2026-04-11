import { Connection } from "@solana/web3.js";
import { FingerprintSDK } from "@fingerprint/sdk";
import {
  upsertEscrow,
  updateEscrowStatus,
  insertAttestation,
  upsertDispute,
  logWebhookEvent,
  markWebhookProcessed,
} from "../db/queries";
import {
  ParsedEvent,
  EscrowCreatedEvent,
  AttestationSubmittedEvent,
  DisputeOpenedEvent,
  DisputeResolvedOnChainEvent,
  FundsReleasedEvent,
  FundsRefundedEvent,
  EscrowFrozenEvent,
  ThresholdMetEvent,
} from "./parser";
import { deriveEscrowPDA, deriveVaultPDA, deriveDisputePDA } from "@fingerprint/sdk";

export class EventProcessor {
  constructor(private sdk: FingerprintSDK) {}

  /**
   * Dispatch a single parsed event to the correct handler.
   * Logs to webhook_events first, processes, then marks done.
   */
  async processEvent(event: ParsedEvent): Promise<void> {
    const logId = await logWebhookEvent(event.type, event);

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
      await markWebhookProcessed(logId);
    } catch (err: any) {
      await markWebhookProcessed(logId, err.message ?? String(err));
      console.error(`Error processing event ${event.type}:`, err);
      // Don't rethrow — we log and continue
    }
  }

  async processEvents(events: ParsedEvent[]): Promise<void> {
    for (const event of events) {
      await this.processEvent(event);
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  private async handleEscrowCreated(event: EscrowCreatedEvent): Promise<void> {
    const escrowId = BigInt(event.escrowId);
    const [escrowPubkey] = deriveEscrowPDA(escrowId);
    const [vaultPubkey] = deriveVaultPDA(escrowId);

    // Fetch full account to get all fields (description, attestors, etc.)
    const onChain = await this.sdk.escrow.fetchEscrow(escrowId);

    await upsertEscrow({
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

  private async handleAttestationSubmitted(
    event: AttestationSubmittedEvent
  ): Promise<void> {
    const escrowId = BigInt(event.escrowId);
    const attestorPubkey = require("@solana/web3.js").PublicKey
      ? new (require("@solana/web3.js").PublicKey)(event.attestor)
      : null;

    const { PublicKey } = require("@solana/web3.js");
    const { deriveAttestationRecordPDA } = require("@fingerprint/sdk");
    const [recordPubkey] = deriveAttestationRecordPDA(
      escrowId,
      new PublicKey(event.attestor)
    );

    await insertAttestation({
      escrow_id: event.escrowId,
      attestor: event.attestor,
      record_pubkey: recordPubkey.toBase58(),
      evidence_cid: event.evidenceCid,
      timestamp_unix: event.timestamp.toString(),
      tx_signature: event.signature,
    });

    console.log(
      `[indexer] AttestationSubmitted: escrow=${event.escrowId} attestor=${event.attestor} count=${event.count}/${event.threshold}`
    );
  }

  private async handleThresholdMet(event: ThresholdMetEvent): Promise<void> {
    await updateEscrowStatus(event.escrowId, "thresholdMet", event.timestamp);
    console.log(`[indexer] ThresholdMet: escrow=${event.escrowId}`);
  }

  private async handleFundsReleased(event: FundsReleasedEvent): Promise<void> {
    await updateEscrowStatus(event.escrowId, "released");
    console.log(`[indexer] FundsReleased: escrow=${event.escrowId} to=${event.receiver}`);
  }

  private async handleFundsRefunded(event: FundsRefundedEvent): Promise<void> {
    await updateEscrowStatus(event.escrowId, "refunded");
    console.log(`[indexer] FundsRefunded: escrow=${event.escrowId} to=${event.payer}`);
  }

  private async handleEscrowFrozen(event: EscrowFrozenEvent): Promise<void> {
    await updateEscrowStatus(event.escrowId, "disputed");
    console.log(`[indexer] EscrowFrozen: escrow=${event.escrowId}`);
  }

  private async handleDisputeOpened(event: DisputeOpenedEvent): Promise<void> {
    const escrowId = BigInt(event.escrowId);
    const [disputePubkey] = deriveDisputePDA(escrowId);

    await upsertDispute({
      escrow_id: event.escrowId,
      dispute_pubkey: disputePubkey.toBase58(),
      disputer: event.disputer,
      reason: event.reason,
      counter_evidence_cid: event.counterEvidenceCid,
      status: "open",
      opened_at_unix: event.timestamp.toString(),
      resolved_at_unix: null,
      resolver_notes: null,
      tx_signature: event.signature,
    });

    console.log(`[indexer] DisputeOpened: escrow=${event.escrowId} disputer=${event.disputer}`);
  }

  private async handleDisputeResolved(
    event: DisputeResolvedOnChainEvent
  ): Promise<void> {
    const finalStatus = event.releaseToReceiver
      ? "resolvedForReceiver"
      : "resolvedForPayer";

    await upsertDispute({
      escrow_id: event.escrowId,
      dispute_pubkey: "", // already exists in DB
      disputer: "",
      reason: "",
      counter_evidence_cid: null,
      status: finalStatus,
      opened_at_unix: "0",
      resolved_at_unix: event.timestamp.toString(),
      resolver_notes: event.resolverNotes,
      tx_signature: event.signature,
    });

    await updateEscrowStatus(
      event.escrowId,
      event.releaseToReceiver ? "released" : "refunded"
    );

    console.log(
      `[indexer] DisputeResolved: escrow=${event.escrowId} releaseToReceiver=${event.releaseToReceiver}`
    );
  }
}