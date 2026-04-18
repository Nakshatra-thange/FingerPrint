import { create } from "zustand";
import type { DisputeSummary, EscrowDetail, EscrowSummary } from "@/types/escrow";

const INDEXER = import.meta.env.VITE_INDEXER_URL ?? "http://localhost:3001";

interface EscrowApiRow {
  escrow_id: string;
  payer: string;
  receiver: string;
  event_description: string;
  amount_lamports: string;
  threshold: number;
  attestation_count?: number;
  status: string;
  threshold_met_at: string | null;
  deadline_unix: string;
  dispute_window_seconds: string;
  required_attestors: string[];
  indexed_at: string;
  created_at: string;
}

interface AttestationApiRow {
  attestor: string;
  evidence_cid: string | null;
  timestamp_unix: string;
  tx_signature: string;
}

interface DisputeApiRow {
  disputer: string;
  reason: string;
  counter_evidence_cid: string | null;
  status: string;
  opened_at_unix: string;
  resolved_at_unix: string | null;
  resolver_notes: string | null;
}

export function mapAnchorError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("DisputeWindowActive")) {
    return "The dispute window is still open.";
  }
  if (message.includes("AlreadyAttested")) {
    return "This wallet already attested on this escrow.";
  }
  if (message.includes("NotAuthorizedAttestor")) {
    return "This wallet is not part of the attestor set.";
  }
  if (message.includes("ThresholdAlreadyReached")) {
    return "The threshold is already met.";
  }
  if (message.includes("ThresholdNotMet")) {
    return "The threshold has not been met yet.";
  }
  if (message.includes("DeadlineNotPassed")) {
    return "The deadline has not passed yet.";
  }
  if (message.includes("DisputeWindowClosed")) {
    return "The dispute window is already closed.";
  }
  if (message.includes("DisputeNotOpen")) {
    return "This dispute is already resolved.";
  }
  if (message.includes("NotAuthorizedResolver")) {
    return "This wallet is not allowed to resolve disputes.";
  }
  if (message.includes("InvalidStatus")) {
    return "This action is not valid in the current escrow state.";
  }

  return "Transaction failed. Check the wallet popup and try again.";
}

export function dbRowToSummary(row: EscrowApiRow): EscrowSummary {
  return {
    escrowId: row.escrow_id,
    eventDescription: row.event_description,
    payer: row.payer,
    receiver: row.receiver,
    amountLamports: row.amount_lamports,
    threshold: row.threshold,
    attestationCount: row.attestation_count ?? 0,
    status: row.status as EscrowSummary["status"],
    thresholdMetAt: row.threshold_met_at,
    deadlineUnix: row.deadline_unix,
    disputeWindowSeconds: row.dispute_window_seconds,
    attestors: row.required_attestors,
    attestedBy: [],
    evidenceCids: {},
    createdAt: row.created_at ?? row.indexed_at,
  };
}

function mapDispute(dispute: DisputeApiRow | null): DisputeSummary | null {
  if (!dispute) return null;

  return {
    disputer: dispute.disputer,
    reason: dispute.reason,
    counterEvidenceCid: dispute.counter_evidence_cid,
    status: dispute.status,
    openedAtUnix: dispute.opened_at_unix,
    resolvedAtUnix: dispute.resolved_at_unix,
    resolverNotes: dispute.resolver_notes,
  };
}

interface EscrowStore {
  escrows: EscrowSummary[];
  attestorEscrows: EscrowSummary[];
  activeEscrow: EscrowDetail | null;
  walletAddress: string | null;
  isLoading: boolean;
  error: string | null;
  success: string | null;
  setWallet: (address: string | null) => void;
  setEscrows: (escrows: EscrowSummary[]) => void;
  setActiveEscrow: (escrow: EscrowDetail | null) => void;
  setLoading: (value: boolean) => void;
  setError: (message: string | null) => void;
  setSuccess: (message: string | null) => void;
  fetchEscrowsForWallet: (address: string) => Promise<void>;
  fetchEscrowsForAttestor: (address: string) => Promise<void>;
  fetchEscrowDetail: (escrowId: string) => Promise<void>;
}

export const useEscrowStore = create<EscrowStore>((set) => ({
  escrows: [],
  attestorEscrows: [],
  activeEscrow: null,
  walletAddress: null,
  isLoading: false,
  error: null,
  success: null,

  setWallet: (address) => set({ walletAddress: address }),
  setEscrows: (escrows) => set({ escrows }),
  setActiveEscrow: (escrow) => set({ activeEscrow: escrow }),
  setLoading: (value) => set({ isLoading: value }),
  setError: (message) => set({ error: message }),
  setSuccess: (message) => set({ success: message }),

  fetchEscrowsForWallet: async (address) => {
    set({ isLoading: true, error: null });
    try {
      const [payerRes, receiverRes] = await Promise.all([
        fetch(`${INDEXER}/api/escrows/by-payer/${address}`),
        fetch(`${INDEXER}/api/escrows/by-receiver/${address}`),
      ]);

      if (!payerRes.ok || !receiverRes.ok) {
        throw new Error("Failed to load escrows");
      }

      const [{ escrows: payerEscrows }, { escrows: receiverEscrows }] =
        (await Promise.all([payerRes.json(), receiverRes.json()])) as [
          { escrows: EscrowApiRow[] },
          { escrows: EscrowApiRow[] }
        ];

      const merged = [...payerEscrows, ...receiverEscrows];
      const unique = new Map<string, EscrowSummary>();
      for (const row of merged) {
        unique.set(row.escrow_id, dbRowToSummary(row));
      }

      set({ escrows: Array.from(unique.values()) });
    } catch {
      set({ error: "Failed to load escrows." });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchEscrowsForAttestor: async (address) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${INDEXER}/api/escrows/by-attestor/${address}`);
      if (!response.ok) {
        throw new Error("Failed to load attestor escrows");
      }

      const { escrows } = (await response.json()) as { escrows: EscrowApiRow[] };
      set({ attestorEscrows: escrows.map(dbRowToSummary) });
    } catch {
      set({ error: "Failed to load attestor escrows." });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchEscrowDetail: async (escrowId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${INDEXER}/api/escrows/${escrowId}`);
      if (!response.ok) {
        throw new Error("Escrow not found");
      }

      const payload = (await response.json()) as {
        escrow: EscrowApiRow;
        attestations: AttestationApiRow[];
        dispute: DisputeApiRow | null;
      };

      const summary = dbRowToSummary(payload.escrow);
      const attestedBy = payload.attestations.map((attestation) => attestation.attestor);
      const evidenceCids = Object.fromEntries(
        payload.attestations
          .filter((attestation) => Boolean(attestation.evidence_cid))
          .map((attestation) => [attestation.attestor, attestation.evidence_cid ?? ""])
      );

      const detail: EscrowDetail = {
        ...summary,
        attestationCount: payload.attestations.length,
        attestedBy,
        evidenceCids,
        attestorDetails: payload.escrow.required_attestors.map((address) => {
          const attestation = payload.attestations.find(
            (candidate) => candidate.attestor === address
          );

          return {
            address,
            attested: Boolean(attestation),
            evidenceCid: attestation?.evidence_cid ?? null,
            attestedAt: attestation?.timestamp_unix ?? null,
            txSignature: attestation?.tx_signature ?? null,
          };
        }),
        dispute: mapDispute(payload.dispute),
      };

      set({ activeEscrow: detail });
    } catch {
      set({ error: "Failed to load escrow detail." });
    } finally {
      set({ isLoading: false });
    }
  },
}));
