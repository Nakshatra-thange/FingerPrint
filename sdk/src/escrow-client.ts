import { PublicKey, SystemProgram, TransactionSignature } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { deriveEscrowPDA, deriveVaultPDA } from "./pda";
import { CreateEscrowParams, EscrowAccount } from "./types";
import { ESCROW_PROGRAM_ID, DEFAULT_DISPUTE_WINDOW_SECONDS } from "./constants";

export class EscrowClient {
  private program: Program;

  constructor(private provider: AnchorProvider, idl: anchor.Idl) {
    this.program = new Program(idl, ESCROW_PROGRAM_ID, provider);
  }

  async createEscrow(params: CreateEscrowParams): Promise<{
    signature: TransactionSignature;
    escrowPubkey: PublicKey;
    vaultPubkey: PublicKey;
  }> {
    const {
      escrowId,
      eventDescription,
      requiredAttestors,
      threshold,
      amountLamports,
      deadlineUnix,
      disputeWindowSeconds = DEFAULT_DISPUTE_WINDOW_SECONDS,
      receiver,
    } = params;

    const [escrowPubkey] = deriveEscrowPDA(escrowId);
    const [vaultPubkey] = deriveVaultPDA(escrowId);

    const signature = await this.program.methods
      .createEscrow(
        new BN(escrowId.toString()),
        eventDescription,
        requiredAttestors,
        threshold,
        new BN(amountLamports.toString()),
        new BN(deadlineUnix),
        new BN(disputeWindowSeconds)
      )
      .accounts({
        escrowAccount: escrowPubkey,
        escrowVault: vaultPubkey,
        payer: this.provider.wallet.publicKey,
        receiver,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { signature, escrowPubkey, vaultPubkey };
  }

  async releaseFunds(
    escrowId: bigint,
    receiver: PublicKey
  ): Promise<TransactionSignature> {
    const [escrowPubkey] = deriveEscrowPDA(escrowId);
    const [vaultPubkey] = deriveVaultPDA(escrowId);

    return this.program.methods
      .releaseFunds(new BN(escrowId.toString()))
      .accounts({
        escrowAccount: escrowPubkey,
        escrowVault: vaultPubkey,
        receiver,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async refund(escrowId: bigint): Promise<TransactionSignature> {
    const [escrowPubkey] = deriveEscrowPDA(escrowId);
    const [vaultPubkey] = deriveVaultPDA(escrowId);

    return this.program.methods
      .refund(new BN(escrowId.toString()))
      .accounts({
        escrowAccount: escrowPubkey,
        escrowVault: vaultPubkey,
        payer: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async fetchEscrow(escrowId: bigint): Promise<EscrowAccount> {
    const [escrowPubkey] = deriveEscrowPDA(escrowId);
    return this.program.account["escrowAccount"].fetch(
      escrowPubkey
    ) as Promise<EscrowAccount>;
  }

  async fetchVaultBalance(escrowId: bigint): Promise<number> {
    const [vaultPubkey] = deriveVaultPDA(escrowId);
    return this.provider.connection.getBalance(vaultPubkey);
  }

  getEscrowPubkey(escrowId: bigint): PublicKey {
    return deriveEscrowPDA(escrowId)[0];
  }

  getVaultPubkey(escrowId: bigint): PublicKey {
    return deriveVaultPDA(escrowId)[0];
  }
}