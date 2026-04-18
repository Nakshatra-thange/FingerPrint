import { AnchorProvider } from "@coral-xyz/anchor";
import type { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import { Connection } from "@solana/web3.js";
import { EscrowClient } from "./escrow-client";
import { AttestationClient } from "./attestation-client";
import { DisputeClient } from "./dispute-client";
import { deriveEscrowPDA, deriveVaultPDA, deriveRegistryPDA, deriveAttestationRecordPDA, deriveDisputePDA } from "./pda";
export interface SDKConfig {
    connection: Connection;
    wallet: Wallet;
    escrowIdl: any;
    attestationIdl: any;
    disputeIdl: any;
}
export declare class FingerprintSDK {
    readonly escrow: EscrowClient;
    readonly attestation: AttestationClient;
    readonly dispute: DisputeClient;
    readonly provider: AnchorProvider;
    constructor(config: SDKConfig);
    setupEscrow(params: Parameters<EscrowClient["createEscrow"]>[0]): Promise<{
        registryPubkey: import("@solana/web3.js").PublicKey;
        registrySignature: string;
        signature: import("@solana/web3.js").TransactionSignature;
        escrowPubkey: import("@solana/web3.js").PublicKey;
        vaultPubkey: import("@solana/web3.js").PublicKey;
    }>;
    fetchFullState(escrowId: bigint): Promise<{
        escrow: import("./types").EscrowAccount;
        registry: import("./types").AttestorRegistry;
        vaultBalance: number;
        attestationMap: Map<string, boolean>;
        dispute: import("./types").DisputeRecord | null;
    }>;
    static pda: {
        escrow: typeof deriveEscrowPDA;
        vault: typeof deriveVaultPDA;
        registry: typeof deriveRegistryPDA;
        attestationRecord: typeof deriveAttestationRecordPDA;
        dispute: typeof deriveDisputePDA;
    };
    static programIds: {
        escrow: import("@solana/web3.js").PublicKey;
        attestation: import("@solana/web3.js").PublicKey;
        dispute: import("@solana/web3.js").PublicKey;
    };
}
export { EscrowClient } from "./escrow-client";
export { AttestationClient } from "./attestation-client";
export { DisputeClient } from "./dispute-client";
export * from "./types";
export * from "./pda";
export * from "./constants";
export * from "./idl";
