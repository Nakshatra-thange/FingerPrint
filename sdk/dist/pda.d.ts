import { PublicKey } from "@solana/web3.js";
export declare function deriveEscrowPDA(escrowId: bigint): [PublicKey, number];
export declare function deriveVaultPDA(escrowId: bigint): [PublicKey, number];
export declare function deriveRegistryPDA(escrowId: bigint): [PublicKey, number];
export declare function deriveAttestationRecordPDA(escrowId: bigint, attestor: PublicKey): [PublicKey, number];
export declare function deriveDisputePDA(escrowId: bigint): [PublicKey, number];
