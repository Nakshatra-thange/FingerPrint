import { PublicKey, TransactionSignature } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider } from "@coral-xyz/anchor";
import { CreateEscrowParams, EscrowAccount } from "./types";
export declare class EscrowClient {
    private provider;
    private program;
    constructor(provider: AnchorProvider, idl: anchor.Idl);
    createEscrow(params: CreateEscrowParams): Promise<{
        signature: TransactionSignature;
        escrowPubkey: PublicKey;
        vaultPubkey: PublicKey;
    }>;
    releaseFunds(escrowId: bigint, receiver: PublicKey): Promise<TransactionSignature>;
    refund(escrowId: bigint): Promise<TransactionSignature>;
    fetchEscrow(escrowId: bigint): Promise<EscrowAccount>;
    fetchVaultBalance(escrowId: bigint): Promise<number>;
    getEscrowPubkey(escrowId: bigint): PublicKey;
    getVaultPubkey(escrowId: bigint): PublicKey;
}
