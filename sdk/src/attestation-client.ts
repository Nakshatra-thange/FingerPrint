import {
    PublicKey,
    SystemProgram,
    TransactionSignature,
  } from "@solana/web3.js";
  import * as anchor from "@coral-xyz/anchor";
  import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
  import {
    deriveEscrowPDA,
    deriveRegistryPDA,
    deriveAttestationRecordPDA,
  } from "./pda";
  import {
    AttestorRegistry,
    AttestationRecord,
    SubmitAttestationParams,
  } from "./types";
  import {
    ATTESTATION_PROGRAM_ID,
    ESCROW_PROGRAM_ID,
  } from "./constants";
  
  export class AttestationClient {
    private program: Program;
  
    constructor(
      private provider: AnchorProvider,
      idl: anchor.Idl
    ) {
      this.program = new Program(idl, ATTESTATION_PROGRAM_ID, provider);
    }
  
    // ── Instructions ────────────────────────────────────────────────────────────
  
    /**
     * Payer initialises the attestor registry right after creating the escrow.
     * Must be called before any attestor can submit.
     */
    async initRegistry(escrowId: bigint): Promise<{
      signature: TransactionSignature;
      registryPubkey: PublicKey;
    }> {
      const [escrowPubkey] = deriveEscrowPDA(escrowId);
      const [registryPubkey] = deriveRegistryPDA(escrowId);
  
      const signature = await this.program.methods
        .initRegistry(new BN(escrowId.toString()))
        .accounts({
          attestorRegistry: registryPubkey,
          escrowAccount: escrowPubkey,
          payer: this.provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
  
      return { signature, registryPubkey };
    }
  
    /**
     * An authorised attestor submits their signed attestation.
     * Optionally attaches an IPFS CID as evidence.
     * If this attestation hits the threshold, automatically CPIs into escrow.
     */
    async submitAttestation(
      params: SubmitAttestationParams
    ): Promise<TransactionSignature> {
      const { escrowId, attestor, evidenceCid } = params;
  
      const [escrowPubkey] = deriveEscrowPDA(escrowId);
      const [registryPubkey] = deriveRegistryPDA(escrowId);
      const [recordPubkey] = deriveAttestationRecordPDA(escrowId, attestor);
  
      return this.program.methods
        .submitAttestation(
          new BN(escrowId.toString()),
          evidenceCid ?? null
        )
        .accounts({
          attestorRegistry: registryPubkey,
          attestationRecord: recordPubkey,
          escrowAccount: escrowPubkey,
          attestor,
          escrowProgram: ESCROW_PROGRAM_ID,
          attestationSelf: ATTESTATION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }
  
    // ── Reads ────────────────────────────────────────────────────────────────────
  
    async fetchRegistry(escrowId: bigint): Promise<AttestorRegistry> {
      const [registryPubkey] = deriveRegistryPDA(escrowId);
      return this.program.account["attestorRegistry"].fetch(
        registryPubkey
      ) as Promise<AttestorRegistry>;
    }
  
    async fetchAttestationRecord(
      escrowId: bigint,
      attestor: PublicKey
    ): Promise<AttestationRecord | null> {
      const [recordPubkey] = deriveAttestationRecordPDA(escrowId, attestor);
      try {
        return (await this.program.account["attestationRecord"].fetch(
          recordPubkey
        )) as AttestationRecord;
      } catch {
        return null;
      }
    }
  
    /**
     * Returns a map of attestor → has attested for all required attestors.
     */
    async getAttestationStatus(
      escrowId: bigint,
      requiredAttestors: PublicKey[]
    ): Promise<Map<string, boolean>> {
      const results = new Map<string, boolean>();
  
      await Promise.all(
        requiredAttestors.map(async (attestor) => {
          const record = await this.fetchAttestationRecord(escrowId, attestor);
          results.set(attestor.toBase58(), record?.attested ?? false);
        })
      );
  
      return results;
    }
  
    getRegistryPubkey(escrowId: bigint): PublicKey {
      return deriveRegistryPDA(escrowId)[0];
    }
  
    getRecordPubkey(escrowId: bigint, attestor: PublicKey): PublicKey {
      return deriveAttestationRecordPDA(escrowId, attestor)[0];
    }
  }