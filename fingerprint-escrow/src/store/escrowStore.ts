import { create } from "zustand";
import type { EscrowSummary, EscrowDetail } from "@/types/escrow";

interface EscrowStore {
  escrows: EscrowSummary[];
  activeEscrow: EscrowDetail | null;
  walletAddress: string | null;
  setWallet: (address: string | null) => void;
  setEscrows: (escrows: EscrowSummary[]) => void;
  setActiveEscrow: (escrow: EscrowDetail | null) => void;
  createEscrow: (data: Partial<EscrowSummary>) => void;
  submitAttestation: (escrowId: string, evidenceCid?: string) => void;
  releaseFunds: (escrowId: string) => void;
}

export const useEscrowStore = create<EscrowStore>((set) => ({
  escrows: [],
  activeEscrow: null,
  walletAddress: null,
  setWallet: (address) => {
    console.log("TODO: setWallet", address);
    set({ walletAddress: address });
  },
  setEscrows: (escrows) => set({ escrows }),
  setActiveEscrow: (escrow) => set({ activeEscrow: escrow }),
  createEscrow: (data) => {
    console.log("TODO: createEscrow on-chain", data);
  },
  submitAttestation: (escrowId, evidenceCid) => {
    console.log("TODO: submitAttestation on-chain", escrowId, evidenceCid);
  },
  releaseFunds: (escrowId) => {
    console.log("TODO: releaseFunds on-chain", escrowId);
  },
}));
