import bs58 from "bs58";
import dotenv from "dotenv";
import { Keypair } from "@solana/web3.js";
import { createSDKFromKeypair } from "@fingerprint/sdk";
import { escrowIdl, attestationIdl, disputeIdl } from "./idls";

dotenv.config();

export function keypairFromBase58OrGenerate(secret?: string): Keypair {
  return secret ? Keypair.fromSecretKey(bs58.decode(secret)) : Keypair.generate();
}

export function createNodeSdk(secret?: string, rpcUrl?: string) {
  const keypair = keypairFromBase58OrGenerate(secret);
  const sdk = createSDKFromKeypair(keypair, rpcUrl ?? process.env.SOLANA_RPC_URL ?? "http://localhost:8899", {
    escrow: escrowIdl,
    attestation: attestationIdl,
    dispute: disputeIdl,
  });

  return { keypair, sdk };
}
