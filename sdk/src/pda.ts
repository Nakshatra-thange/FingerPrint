import { PublicKey } from "@solana/web3.js";
import {
  ESCROW_PROGRAM_ID,
  ATTESTATION_PROGRAM_ID,
  DISPUTE_PROGRAM_ID,
  SEEDS,
} from "./constants";

function escrowIdToBytes(escrowId: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(escrowId);
  return buf;
}

export function deriveEscrowPDA(escrowId: bigint): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.ESCROW), escrowIdToBytes(escrowId)],
    ESCROW_PROGRAM_ID
  );
}

export function deriveVaultPDA(escrowId: bigint): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.VAULT), escrowIdToBytes(escrowId)],
    ESCROW_PROGRAM_ID
  );
}

export function deriveRegistryPDA(escrowId: bigint): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.REGISTRY), escrowIdToBytes(escrowId)],
    ATTESTATION_PROGRAM_ID
  );
}

export function deriveAttestationRecordPDA(
  escrowId: bigint,
  attestor: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(SEEDS.ATTESTATION),
      escrowIdToBytes(escrowId),
      attestor.toBuffer(),
    ],
    ATTESTATION_PROGRAM_ID
  );
}

export function deriveDisputePDA(escrowId: bigint): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.DISPUTE), escrowIdToBytes(escrowId)],
    DISPUTE_PROGRAM_ID
  );
}