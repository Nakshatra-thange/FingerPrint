import { PublicKey } from "@solana/web3.js";
export declare const ESCROW_PROGRAM_ID: PublicKey;
export declare const ATTESTATION_PROGRAM_ID: PublicKey;
export declare const DISPUTE_PROGRAM_ID: PublicKey;
export declare const DISPUTE_RESOLVER: PublicKey;
export declare const DEFAULT_DISPUTE_WINDOW_SECONDS: number;
export declare const SEEDS: {
    readonly ESCROW: "escrow";
    readonly VAULT: "vault";
    readonly REGISTRY: "registry";
    readonly ATTESTATION: "attestation";
    readonly DISPUTE: "dispute";
};
