import { PublicKey, TransactionSignature } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider } from "@coral-xyz/anchor";
import { AttestorRegistry, AttestationRecord, SubmitAttestationParams } from "./types";
export declare class AttestationClient {
    private provider;
    private program;
    constructor(provider: AnchorProvider, idl: anchor.Idl);
    /**
     * Payer initialises the attestor registry right after creating the escrow.
     * Must be called before any attestor can submit.
     */
    initRegistry(escrowId: bigint): Promise<{
        signature: TransactionSignature;
        registryPubkey: PublicKey;
    }>;
    /**
     * An authorised attestor submits their signed attestation.
     * Optionally attaches an IPFS CID as evidence.
     * If this attestation hits the threshold, automatically CPIs into escrow.
     */
    submitAttestation(params: SubmitAttestationParams): Promise<TransactionSignature>;
    fetchRegistry(escrowId: bigint): Promise<AttestorRegistry>;
    fetchAttestationRecord(escrowId: bigint, attestor: PublicKey): Promise<AttestationRecord | null>;
    /**
     * Returns a map of attestor → has attested for all required attestors.
     */
    getAttestationStatus(escrowId: bigint, requiredAttestors: PublicKey[]): Promise<Map<string, boolean>>;
    getRegistryPubkey(escrowId: bigint): PublicKey;
    getRecordPubkey(escrowId: bigint, attestor: PublicKey): PublicKey;
}
