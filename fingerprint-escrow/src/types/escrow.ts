export type EscrowStatus = "active" | "thresholdMet" | "disputed" | "released" | "refunded";

export interface EscrowSummary {
  escrowId: string;
  eventDescription: string;
  payer: string;
  receiver: string;
  amountLamports: string;
  threshold: number;
  attestationCount: number;
  status: EscrowStatus;
  thresholdMetAt: string | null;
  deadlineUnix: string;
  disputeWindowSeconds: string;
  attestors: string[];
  attestedBy: string[];
  evidenceCids: Record<string, string>;
  createdAt: string;
}

export interface EscrowDetail extends EscrowSummary {
  attestorDetails: {
    address: string;
    attested: boolean;
    evidenceCid: string | null;
    attestedAt: string | null;
    txSignature: string | null;
  }[];
}
