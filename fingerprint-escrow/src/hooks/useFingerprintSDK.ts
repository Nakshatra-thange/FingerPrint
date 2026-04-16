import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { FingerprintSDK } from "../../../sdk/src/index";

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
    const anchorWallet = {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction.bind(wallet),
      signAllTransactions: wallet.signAllTransactions.bind(wallet),
    };

    return new FingerprintSDK({
      connection,
      wallet: anchorWallet,
      escrowIdl,
      attestationIdl,
      disputeIdl,
    });
  }, [wallet.publicKey, connection]);
}