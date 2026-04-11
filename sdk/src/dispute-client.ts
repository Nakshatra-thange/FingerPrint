import {
    PublicKey,
    SystemProgram,
    TransactionSignature,
  } from "@solana/web3.js";
  import * as anchor from "@coral-xyz/anchor";
  import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
  import {
    deriveEscrowPDA,
    deriveVaultPDA,
    deriveDisputePDA,
  } from "./pda";
  import {
    DisputeRecord,
    OpenDisputeParams,
    ResolveDisputeParams,
  } from "./types";
  import {
    DISPUTE_PROGRAM_ID,
    ESCROW_PROGRAM_ID,
  } from "./constants";
  
  export class DisputeClient {
    private program: Program;
  
    constructor(
      private provider: AnchorProvider,
      idl: anchor.Idl
    ) {
      this.program = new Program(idl, DISPUTE_PROGRAM_ID, provider);
    }
  
    // ── Instructions ────────────────────────────────────────────────────────────
  
    /**
     * Payer opens a dispute within the dispute window.
     * Freezes the escrow — auto-release is blocked until resolved.
     */
    async openDispute(params: OpenDisputeParams): Promise<{
      signature: TransactionSignature;
      disputePubkey: PublicKey;
    }> {
      const { escrowId, reason, counterEvidenceCid } = params;
  
      const [escrowPubkey] = deriveEscrowPDA(escrowId);
      const [disputePubkey] = deriveDisputePDA(escrowId);
  
      const signature = await this.program.methods
        .openDispute(
          new BN(escrowId.toString()),
          reason,
          counterEvidenceCid ?? null
        )
        .accounts({
          disputeRecord: disputePubkey,
          escrowAccount: escrowPubkey,
          disputer: this.provider.wallet.publicKey,
          escrowProgram: ESCROW_PROGRAM_ID,
          disputeSelf: DISPUTE_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
  
      return { signature, disputePubkey };
    }
  
    /**
     * Resolver (multisig / DAO) decides the outcome.
     * releaseToReceiver = true  → receiver gets paid (attestations valid)
     * releaseToReceiver = false → payer refunded (dispute upheld)
     */
    async resolveDispute(params: ResolveDisputeParams): Promise<TransactionSignature> {
      const { escrowId, releaseToReceiver, resolverNotes } = params;
  
      const escrow = await this.fetchEscrowForDispute(escrowId);
  
      const [escrowPubkey] = deriveEscrowPDA(escrowId);
      const [vaultPubkey] = deriveVaultPDA(escrowId);
      const [disputePubkey] = deriveDisputePDA(escrowId);
  
      return this.program.methods
        .resolveDispute(
          new BN(escrowId.toString()),
          releaseToReceiver,
          resolverNotes ?? null
        )
        .accounts({
          disputeRecord: disputePubkey,
          escrowAccount: escrowPubkey,
          escrowVault: vaultPubkey,
          receiver: escrow.receiver,
          payerAccount: escrow.payer,
          resolver: this.provider.wallet.publicKey,
          escrowProgram: ESCROW_PROGRAM_ID,
          disputeSelf: DISPUTE_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }
  
    // ── Reads ────────────────────────────────────────────────────────────────────
  
    async fetchDispute(escrowId: bigint): Promise<DisputeRecord | null> {
      const [disputePubkey] = deriveDisputePDA(escrowId);
      try {
        return (await this.program.account["disputeRecord"].fetch(
          disputePubkey
        )) as DisputeRecord;
      } catch {
        return null;
      }
    }
  
    getDisputePubkey(escrowId: bigint): PublicKey {
      return deriveDisputePDA(escrowId)[0];
    }
  
    // ── Private helpers ──────────────────────────────────────────────────────────
  
    private async fetchEscrowForDispute(escrowId: bigint) {
      // We need the payer and receiver from the escrow account
      // Import dynamically to avoid circular dep
      const { deriveEscrowPDA } = await import("./pda");
      const [escrowPubkey] = deriveEscrowPDA(escrowId);
      const raw = await this.program.provider.connection.getAccountInfo(escrowPubkey);
      if (!raw) throw new Error(`Escrow ${escrowId} not found`);
      // Decode using Anchor's coder — program has escrow IDL via CPI dependency
      // In practice the indexer supplies this; here we read direct from chain
      const escrowProgram = new Program(
        require("../../target/idl/escrow.json"),
        ESCROW_PROGRAM_ID,
        this.provider
      );
      return escrowProgram.account["escrowAccount"].fetch(escrowPubkey) as any;
    }
  }