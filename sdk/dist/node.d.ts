import { Keypair } from "@solana/web3.js";
import { FingerprintSDK } from "./browser";
export declare function createSDKFromKeypair(keypair: Keypair, rpcUrl: string, idls: {
    escrow: any;
    attestation: any;
    dispute: any;
}): FingerprintSDK;
