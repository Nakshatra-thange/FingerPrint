import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { Wallet as AnchorWallet } from "@coral-xyz/anchor/dist/cjs/provider";
import { FingerprintSDK } from "../../../sdk/src/browser";

// IDLs — generated after anchor build
import escrowIdl from "../../../fingerprint/target/idl/escrow.json";
import attestationIdl from "../../../fingerprint/target/idl/attestation.json";
import disputeIdl from "../../../fingerprint/target/idl/dispute.json";

export function useFingerprintSDK(): FingerprintSDK | null {
  const { connection } = useConnection();
  const wallet = useWallet();

  return useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
      return null;
    }

    // Wrap wallet adapter to match Anchor's Wallet interface
    const anchorWallet: AnchorWallet = {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
    };

    return new FingerprintSDK({
      connection,
      wallet: anchorWallet,
      escrowIdl,
      attestationIdl,
      disputeIdl,
    });
  }, [connection, wallet.publicKey, wallet.signAllTransactions, wallet.signTransaction]);
}
