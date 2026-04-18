import { PublicKey, TransactionSignature } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider } from "@coral-xyz/anchor";
import { DisputeRecord, OpenDisputeParams, ResolveDisputeParams } from "./types";
export declare class DisputeClient {
    private provider;
    private escrowIdl;
    private program;
    constructor(provider: AnchorProvider, idl: anchor.Idl, escrowIdl: anchor.Idl);
    /**
     * Payer opens a dispute within the dispute window.
     * Freezes the escrow — auto-release is blocked until resolved.
     */
    openDispute(params: OpenDisputeParams): Promise<{
        signature: TransactionSignature;
        disputePubkey: PublicKey;
    }>;
    /**
     * Resolver (multisig / DAO) decides the outcome.
     * releaseToReceiver = true  → receiver gets paid (attestations valid)
     * releaseToReceiver = false → payer refunded (dispute upheld)
     */
    resolveDispute(params: ResolveDisputeParams): Promise<TransactionSignature>;
    fetchDispute(escrowId: bigint): Promise<DisputeRecord | null>;
    getDisputePubkey(escrowId: bigint): PublicKey;
    private fetchEscrowForDispute;
}
