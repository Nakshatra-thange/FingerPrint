import { PublicKey } from "@solana/web3.js";

export const ESCROW_PROGRAM_ID = new PublicKey(
  "6MXh43qNLot7M8B7K2W1eshywgZecDRfkLazRKLmQZ5S"
);

export const ATTESTATION_PROGRAM_ID = new PublicKey(
  "dTydWteGkLkpESKHHW9QeRFD5yBDe3CAjZPVuKrNxCX"
);

export const DISPUTE_PROGRAM_ID = new PublicKey(
  "HtcJfyMQodiZZx6D2MwRT8DiwXL7Lgwd9P16HbvpDRc4"
);

export const DEFAULT_DISPUTE_WINDOW_SECONDS = 24 * 60 * 60;

export const SEEDS = {
  ESCROW: "escrow",
  VAULT: "vault",
  REGISTRY: "registry",
  ATTESTATION: "attestation",
  DISPUTE: "dispute",
} as const;
