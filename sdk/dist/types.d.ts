import { PublicKey } from "@solana/web3.js";
export interface CreateEscrowParams {
    escrowId: bigint;
    eventDescription: string;
    requiredAttestors: PublicKey[];
    threshold: number;
    amountLamports: bigint;
    deadlineUnix: number;
    disputeWindowSeconds?: number;
    receiver: PublicKey;
}
export declare enum EscrowStatus {
    Active = "active",
    ThresholdMet = "thresholdMet",
    Disputed = "disputed",
    Released = "released",
    Refunded = "refunded"
}
export interface EscrowAccount {
    escrowId: bigint;
    payer: PublicKey;
    receiver: PublicKey;
    eventDescription: string;
    requiredAttestors: PublicKey[];
    threshold: number;
    amount: bigint;
    deadline: bigint;
    disputeWindowSeconds: bigint;
    status: EscrowStatus;
    thresholdMetAt: bigint | null;
    createdAt: bigint;
    bump: number;
}
export interface SubmitAttestationParams {
    escrowId: bigint;
    attestor: PublicKey;
    evidenceCid?: string;
}
export interface AttestorRegistry {
    escrowId: bigint;
    escrow: PublicKey;
    requiredAttestors: PublicKey[];
    threshold: number;
    attestationCount: number;
    thresholdReached: boolean;
    bump: number;
}
export interface AttestationRecord {
    escrowId: bigint;
    attestor: PublicKey;
    attested: boolean;
    evidenceCid: string | null;
    timestamp: bigint;
    bump: number;
}
export interface OpenDisputeParams {
    escrowId: bigint;
    reason: string;
    counterEvidenceCid?: string;
}
export interface ResolveDisputeParams {
    escrowId: bigint;
    releaseToReceiver: boolean;
    resolverNotes?: string;
}
export declare enum DisputeStatus {
    Open = "open",
    ResolvedForReceiver = "resolvedForReceiver",
    ResolvedForPayer = "resolvedForPayer"
}
export interface DisputeRecord {
    escrowId: bigint;
    disputer: PublicKey;
    reason: string;
    counterEvidenceCid: string | null;
    status: DisputeStatus;
    openedAt: bigint;
    resolvedAt: bigint | null;
    resolverNotes: string | null;
    bump: number;
}
