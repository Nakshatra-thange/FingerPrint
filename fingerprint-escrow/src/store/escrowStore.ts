import { create } from "zustand";
import type { EscrowSummary, EscrowDetail } from "@/types/escrow";

const INDEXER = import.meta.env.VITE_INDEXER_URL ?? "http://localhost:3001";

// Anchor error code → human message
export function mapAnchorError(err: any): string {
  const msg = err?.message ?? String(err);
  if (msg.includes("DisputeWindowActive")) return "Dispute window still open — check back later.";
  if (msg.includes("AlreadyAttested")) return "You've already attested to this event.";
  if (msg.includes("NotAuthorizedAttestor")) return "Your wallet isn't listed as an attestor for this escrow.";
  if (msg.includes("InvalidStatus")) return "This action isn't valid for the current escrow status.";
  if (msg.includes("DeadlineNotPassed")) return "The deadline hasn't passed yet.";
  if (msg.includes("OnlyPayerCanDispute")) return "Only the payer can open a dispute.";
  return "Transaction failed. Check your wallet and try again.";
}

interface EscrowStore {
  escrows: EscrowSummary[];
  activeEscrow: EscrowDetail | null;
  walletAddress: string | null;
  isLoading: boolean;
  error: string | null;

  setWallet: (address: string | null) => void;
  setEscrows: (escrows: EscrowSummary[]) => void;
  setActiveEscrow: (escrow: EscrowDetail | null) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;

  // These need the SDK instance passed in — called from components
  fetchEscrowsForWallet: (address: string) => Promise<void>;
  fetchEscrowDetail: (escrowId: string) => Promise<void>;
}

export const useEscrowStore = create<EscrowStore>((set) => ({
  escrows: [],
  activeEscrow: null,
  walletAddress: null,
  isLoading: false,
  error: null,

  setWallet: (address) => set({ walletAddress: address }),
  setEscrows: (escrows) => set({ escrows }),
  setActiveEscrow: (escrow) => set({ activeEscrow: escrow }),
  setLoading: (v) => set({ isLoading: v }),
  setError: (e) => set({ error: e }),

  fetchEscrowsForWallet: async (address) => {
    set({ isLoading: true, error: null });
    try {
      const [payerRes, receiverRes] = await Promise.all([
        fetch(`${INDEXER}/api/escrows/by-payer/${address}`),
        fetch(`${INDEXER}/api/escrows/by-receiver/${address}`),
      ]);
      const [{ escrows: asP }, { escrows: asR }] = await Promise.all([
        payerRes.json(),
        receiverRes.json(),
      ]);
      // Merge and dedupe by escrow_id
      const seen = new Set<string>();
      const merged: EscrowSummary[] = [];
      for (const e of [...asP, ...asR]) {
        if (!seen.has(e.escrow_id)) {
          seen.add(e.escrow_id);
          merged.push(dbRowToSummary(e));
        }
      }
      set({ escrows: merged });
    } catch (err: any) {
      set({ error: "Failed to load escrows from indexer." });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchEscrowDetail: async (escrowId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${INDEXER}/api/escrows/${escrowId}`);
      if (!res.ok) throw new Error("Not found");
      const { escrow, attestations, dispute } = await res.json();
      const summary = dbRowToSummary(escrow);
      const detail: EscrowDetail = {
        ...summary,
        attestorDetails: escrow.required_attestors.map((addr: string) => {
          const att = attestations.find((a: any) => a.attestor === addr);
          return {
            address: addr,
            attested: !!att,
            evidenceCid: att?.evidence_cid ?? null,
            attestedAt: att ? new Date(Number(att.timestamp_unix) * 1000).toISOString() : null,
            txSignature: att?.tx_signature ?? null,
          };
        }),
      };
      set({ activeEscrow: detail });
    } catch (err: any) {
      set({ error: "Failed to load escrow detail." });
    } finally {
      set({ isLoading: false });
    }
  },
}));

// Convert Postgres row shape → EscrowSummary used in components
export function dbRowToSummary(row: any): EscrowSummary {
  return {
    escrowId: row.escrow_id,
    eventDescription: row.event_description,
    payer: row.payer,
    receiver: row.receiver,
    amountLamports: row.amount_lamports,
    threshold: row.threshold,
    attestationCount: 0, // will be filled from attestations separately
    status: row.status,
    thresholdMetAt: row.threshold_met_at,
    deadlineUnix: row.deadline_unix,
    disputeWindowSeconds: row.dispute_window_seconds,
    attestors: row.required_attestors,
    attestedBy: [],
    evidenceCids: {},
    createdAt: row.indexed_at,
  };
}