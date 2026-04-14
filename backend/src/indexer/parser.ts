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

import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  ESCROW_PROGRAM_ID,
  ATTESTATION_PROGRAM_ID,
  DISPUTE_PROGRAM_ID,
  normalizeIdl,
} from "@fingerprint/sdk";

// ── Helius webhook payload shape ─────────────────────────────────────────────

export interface HeliusWebhookPayload {
  webhookType: string;
  accountAddresses?: string[];
  transactions: HeliusTransaction[];
}

export interface HeliusTransaction {
  signature: string;
  slot: number;
  timestamp: number;
  feePayer: string;
  logs: string[];
  accountData: { account: string; nativeBalanceChange: number }[];
  instructions: {
    programId: string;
    accounts: string[];
    data: string;
  }[];
}

// ── Our parsed event types ────────────────────────────────────────────────────

export type ParsedEvent =
  | EscrowCreatedEvent
  | ThresholdMetEvent
  | FundsReleasedEvent
  | FundsRefundedEvent
  | EscrowFrozenEvent
  | DisputeResolvedEvent
  | AttestationSubmittedEvent
  | RegistryInitialisedEvent
  | ThresholdReachedEvent
  | DisputeOpenedEvent
  | DisputeResolvedOnChainEvent;

interface BaseEvent {
  signature: string;
  slot: number;
  blockTime: number;
  programId: string;
}

export interface EscrowCreatedEvent extends BaseEvent {
  type: "EscrowCreated";
  escrowId: string;
  payer: string;
  receiver: string;
  amount: string;
  threshold: number;
  deadline: string;
}

export interface ThresholdMetEvent extends BaseEvent {
  type: "ThresholdMet";
  escrowId: string;
  timestamp: string;
}

export interface FundsReleasedEvent extends BaseEvent {
  type: "FundsReleased";
  escrowId: string;
  receiver: string;
  amount: string;
}

export interface FundsRefundedEvent extends BaseEvent {
  type: "FundsRefunded";
  escrowId: string;
  payer: string;
  amount: string;
}

export interface EscrowFrozenEvent extends BaseEvent {
  type: "EscrowFrozen";
  escrowId: string;
  timestamp: string;
}

export interface DisputeResolvedEvent extends BaseEvent {
  type: "DisputeResolved";
  escrowId: string;
  releaseToReceiver: boolean;
}

export interface AttestationSubmittedEvent extends BaseEvent {
  type: "AttestationSubmitted";
  escrowId: string;
  attestor: string;
  count: number;
  threshold: number;
  evidenceCid: string | null;
}

export interface RegistryInitialisedEvent extends BaseEvent {
  type: "RegistryInitialised";
  escrowId: string;
  attestors: string[];
  threshold: number;
}

export interface ThresholdReachedEvent extends BaseEvent {
  type: "ThresholdReached";
  escrowId: string;
  count: number;
}

export interface DisputeOpenedEvent extends BaseEvent {
  type: "DisputeOpened";
  escrowId: string;
  disputer: string;
  reason: string;
  counterEvidenceCid: string | null;
}

export interface DisputeResolvedOnChainEvent extends BaseEvent {
  type: "DisputeResolvedOnChain";
  escrowId: string;
  releaseToReceiver: boolean;
  resolverNotes: string | null;
}

// ── Parser ────────────────────────────────────────────────────────────────────

export class EventParser {
  private escrowParser: anchor.EventParser;
  private attestationParser: anchor.EventParser;
  private disputeParser: anchor.EventParser;

  constructor(
    escrowIdl: anchor.Idl,
    attestationIdl: anchor.Idl,
    disputeIdl: anchor.Idl
  ) {
    this.escrowParser = new anchor.EventParser(
      ESCROW_PROGRAM_ID,
      new anchor.BorshCoder(normalizeIdl(escrowIdl))
    );
    this.attestationParser = new anchor.EventParser(
      ATTESTATION_PROGRAM_ID,
      new anchor.BorshCoder(normalizeIdl(attestationIdl))
    );
    this.disputeParser = new anchor.EventParser(
      DISPUTE_PROGRAM_ID,
      new anchor.BorshCoder(normalizeIdl(disputeIdl))
    );
  }

  /**
   * Parse all events from a Helius transaction payload.
   * Returns a flat array of typed ParsedEvent objects.
   */
  parseTransaction(tx: HeliusTransaction): ParsedEvent[] {
    const events: ParsedEvent[] = [];
    const meta = { signature: tx.signature, slot: tx.slot, blockTime: tx.timestamp };

    // Escrow program events
    for (const event of this.escrowParser.parseLogs(tx.logs)) {
      const parsed = this.mapEscrowEvent(event, meta);
      if (parsed) events.push(parsed);
    }

    // Attestation program events
    for (const event of this.attestationParser.parseLogs(tx.logs)) {
      const parsed = this.mapAttestationEvent(event, meta);
      if (parsed) events.push(parsed);
    }

    // Dispute program events
    for (const event of this.disputeParser.parseLogs(tx.logs)) {
      const parsed = this.mapDisputeEvent(event, meta);
      if (parsed) events.push(parsed);
    }

    return events;
  }

  parseWebhookPayload(payload: HeliusWebhookPayload): ParsedEvent[] {
    return payload.transactions.flatMap((tx) => this.parseTransaction(tx));
  }

  // ── Private mappers ──────────────────────────────────────────────────────────

  private mapEscrowEvent(
    event: anchor.Event,
    meta: { signature: string; slot: number; blockTime: number }
  ): ParsedEvent | null {
    const base = { ...meta, programId: ESCROW_PROGRAM_ID.toBase58() };

    switch (event.name) {
      case "EscrowCreated":
        return {
          type: "EscrowCreated",
          ...base,
          escrowId: (event.data.escrowId as anchor.BN).toString(),
          payer: (event.data.payer as PublicKey).toBase58(),
          receiver: (event.data.receiver as PublicKey).toBase58(),
          amount: (event.data.amount as anchor.BN).toString(),
          threshold: event.data.threshold as number,
          deadline: (event.data.deadline as anchor.BN).toString(),
        };

      case "ThresholdMet":
        return {
          type: "ThresholdMet",
          ...base,
          escrowId: (event.data.escrowId as anchor.BN).toString(),
          timestamp: (event.data.timestamp as anchor.BN).toString(),
        };

      case "FundsReleased":
        return {
          type: "FundsReleased",
          ...base,
          escrowId: (event.data.escrowId as anchor.BN).toString(),
          receiver: (event.data.receiver as PublicKey).toBase58(),
          amount: (event.data.amount as anchor.BN).toString(),
        };

      case "FundsRefunded":
        return {
          type: "FundsRefunded",
          ...base,
          escrowId: (event.data.escrowId as anchor.BN).toString(),
          payer: (event.data.payer as PublicKey).toBase58(),
          amount: (event.data.amount as anchor.BN).toString(),
        };

      case "EscrowFrozen":
        return {
          type: "EscrowFrozen",
          ...base,
          escrowId: (event.data.escrowId as anchor.BN).toString(),
          timestamp: (event.data.timestamp as anchor.BN).toString(),
        };

      case "DisputeResolved":
        return {
          type: "DisputeResolved",
          ...base,
          escrowId: (event.data.escrowId as anchor.BN).toString(),
          releaseToReceiver: event.data.releaseToReceiver as boolean,
        };

      default:
        return null;
    }
  }

  private mapAttestationEvent(
    event: anchor.Event,
    meta: { signature: string; slot: number; blockTime: number }
  ): ParsedEvent | null {
    const base = { ...meta, programId: ATTESTATION_PROGRAM_ID.toBase58() };

    switch (event.name) {
      case "AttestationSubmitted":
        return {
          type: "AttestationSubmitted",
          ...base,
          escrowId: (event.data.escrowId as anchor.BN).toString(),
          attestor: (event.data.attestor as PublicKey).toBase58(),
          count: event.data.count as number,
          threshold: event.data.threshold as number,
          evidenceCid: (event.data.evidenceCid as string | null) ?? null,
        };

      case "RegistryInitialised":
        return {
          type: "RegistryInitialised",
          ...base,
          escrowId: (event.data.escrowId as anchor.BN).toString(),
          attestors: (event.data.attestors as PublicKey[]).map((p) => p.toBase58()),
          threshold: event.data.threshold as number,
        };

      case "ThresholdReached":
        return {
          type: "ThresholdReached",
          ...base,
          escrowId: (event.data.escrowId as anchor.BN).toString(),
          count: event.data.count as number,
        };

      default:
        return null;
    }
  }

  private mapDisputeEvent(
    event: anchor.Event,
    meta: { signature: string; slot: number; blockTime: number }
  ): ParsedEvent | null {
    const base = { ...meta, programId: DISPUTE_PROGRAM_ID.toBase58() };

    switch (event.name) {
      case "DisputeOpened":
        return {
          type: "DisputeOpened",
          ...base,
          escrowId: (event.data.escrowId as anchor.BN).toString(),
          disputer: (event.data.disputer as PublicKey).toBase58(),
          reason: event.data.reason as string,
          counterEvidenceCid: (event.data.counterEvidenceCid as string | null) ?? null,
        };

      case "DisputeResolved":
        return {
          type: "DisputeResolvedOnChain",
          ...base,
          escrowId: (event.data.escrowId as anchor.BN).toString(),
          releaseToReceiver: event.data.releaseToReceiver as boolean,
          resolverNotes: (event.data.resolverNotes as string | null) ?? null,
        };

      default:
        return null;
    }
  }
}
