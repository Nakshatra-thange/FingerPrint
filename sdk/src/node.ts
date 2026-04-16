import type { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Connection, Keypair } from "@solana/web3.js";
import { FingerprintSDK } from "./browser";

export function createSDKFromKeypair(
  keypair: Keypair,
  rpcUrl: string,
  idls: { escrow: any; attestation: any; dispute: any }
): FingerprintSDK {
  const connection = new Connection(rpcUrl, "confirmed");
  const wallet: Wallet = new NodeWallet(keypair);

  return new FingerprintSDK({
    connection,
    wallet,
    escrowIdl: idls.escrow,
    attestationIdl: idls.attestation,
    disputeIdl: idls.dispute,
  });
}
