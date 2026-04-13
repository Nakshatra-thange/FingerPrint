import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import { EscrowClient } from "./escrow-client";
import { AttestationClient } from "./attestation-client";
import { DisputeClient } from "./dispute-client";
import {
  ESCROW_PROGRAM_ID,
  ATTESTATION_PROGRAM_ID,
  DISPUTE_PROGRAM_ID,
} from "./constants";
import {
  deriveEscrowPDA,
  deriveVaultPDA,
  deriveRegistryPDA,
  deriveAttestationRecordPDA,
  deriveDisputePDA,
} from "./pda";

export interface SDKConfig {
  connection: Connection;
  wallet: Wallet;
  escrowIdl: any;
  attestationIdl: any;
  disputeIdl: any;
}

export class FingerprintSDK {
  public readonly escrow: EscrowClient;
  public readonly attestation: AttestationClient;
  public readonly dispute: DisputeClient;
  public readonly provider: AnchorProvider;

  constructor(config: SDKConfig) {
    this.provider = new AnchorProvider(config.connection, config.wallet, {
      commitment: "confirmed",
    });

    this.escrow = new EscrowClient(this.provider, config.escrowIdl);
    this.attestation = new AttestationClient(this.provider, config.attestationIdl);
    this.dispute = new DisputeClient(this.provider, config.disputeIdl);
  }

  /**
   * Convenience: create escrow + init registry in two sequential txs.
   * Returns both pubkeys and signatures.
   */
  async setupEscrow(params: Parameters<EscrowClient["createEscrow"]>[0]) {
    const result = await this.escrow.createEscrow(params);
    const registryResult = await this.attestation.initRegistry(params.escrowId);

    return {
      ...result,
      registryPubkey: registryResult.registryPubkey,
      registrySignature: registryResult.signature,
    };
  }

  /**
   * Convenience: fetch a complete snapshot of an escrow — account state,
   * registry state, all attestation records, and any dispute record.
   */
  async fetchFullState(escrowId: bigint) {
    const escrow = await this.escrow.fetchEscrow(escrowId);
    const registry = await this.attestation.fetchRegistry(escrowId);
    const vaultBalance = await this.escrow.fetchVaultBalance(escrowId);

    const attestationMap = await this.attestation.getAttestationStatus(
      escrowId,
      registry.requiredAttestors
    );

    const dispute = await this.dispute.fetchDispute(escrowId);

    return {
      escrow,
      registry,
      vaultBalance,
      attestationMap,
      dispute,
    };
  }

  // Re-export PDA helpers so consumers don't need to import separately
  static pda = {
    escrow: deriveEscrowPDA,
    vault: deriveVaultPDA,
    registry: deriveRegistryPDA,
    attestationRecord: deriveAttestationRecordPDA,
    dispute: deriveDisputePDA,
  };

  static programIds = {
    escrow: ESCROW_PROGRAM_ID,
    attestation: ATTESTATION_PROGRAM_ID,
    dispute: DISPUTE_PROGRAM_ID,
  };
}

// ── Convenience factory for Node.js scripts / backend services ───────────────

export function createSDKFromKeypair(
  keypair: Keypair,
  rpcUrl: string,
  idls: { escrow: any; attestation: any; dispute: any }
): FingerprintSDK {
  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = new (class implements Wallet {
    publicKey = keypair.publicKey;
    async signTransaction(tx: any) {
      tx.partialSign(keypair);
      return tx;
    }
    async signAllTransactions(txs: any[]) {
      return txs.map((tx) => {
        tx.partialSign(keypair);
        return tx;
      });
    }
  })();

  return new FingerprintSDK({
    connection,
    wallet,
    escrowIdl: idls.escrow,
    attestationIdl: idls.attestation,
    disputeIdl: idls.dispute,
  });
}

// ── Exports ───────────────────────────────────────────────────────────────────

export { EscrowClient } from "./escrow-client";
export { AttestationClient } from "./attestation-client";
export { DisputeClient } from "./dispute-client";
export * from "./types";
export * from "./pda";
export * from "./constants";