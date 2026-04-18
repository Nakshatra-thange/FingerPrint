import { AnchorProvider } from "@coral-xyz/anchor";
import type { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import { Connection } from "@solana/web3.js";
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
    this.dispute = new DisputeClient(
      this.provider,
      config.disputeIdl,
      config.escrowIdl
    );
  }

  async setupEscrow(params: Parameters<EscrowClient["createEscrow"]>[0]) {
    const result = await this.escrow.createEscrow(params);
    const registryResult = await this.attestation.initRegistry(params.escrowId);
    return {
      ...result,
      registryPubkey: registryResult.registryPubkey,
      registrySignature: registryResult.signature,
    };
  }

  async fetchFullState(escrowId: bigint) {
    const escrow = await this.escrow.fetchEscrow(escrowId);
    const registry = await this.attestation.fetchRegistry(escrowId);
    const vaultBalance = await this.escrow.fetchVaultBalance(escrowId);
    const attestationMap = await this.attestation.getAttestationStatus(
      escrowId,
      registry.requiredAttestors
    );
    const dispute = await this.dispute.fetchDispute(escrowId);
    return { escrow, registry, vaultBalance, attestationMap, dispute };
  }

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

export { EscrowClient } from "./escrow-client";
export { AttestationClient } from "./attestation-client";
export { DisputeClient } from "./dispute-client";
export * from "./types";
export * from "./pda";
export * from "./constants";
export * from "./idl";
