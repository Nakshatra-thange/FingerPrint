import type { EscrowSummary } from "@/types/escrow";
import { StatusBadge } from "./StatusBadge";
import { AttestationProgress } from "./AttestationProgress";
import { Countdown } from "./Countdown";
import { WalletAddress } from "./WalletAddress";
import { useNavigate } from "react-router-dom";

function lamportsToSol(lamports: string): string {
  return (Number(lamports) / 1_000_000_000).toFixed(2);
}

export function EscrowCard({ escrow }: { escrow: EscrowSummary }) {
  const navigate = useNavigate();
  const disputeEnd =
    escrow.thresholdMetAt
      ? Number(escrow.thresholdMetAt) + Number(escrow.disputeWindowSeconds)
      : null;

  return (
    <button
      onClick={() => navigate(`/escrow/${escrow.escrowId}`)}
      className="w-full text-left rounded-lg border bg-card p-5 space-y-3 hover:border-primary/30 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug line-clamp-2">{escrow.eventDescription}</p>
        <StatusBadge status={escrow.status} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="text-foreground font-medium">{lamportsToSol(escrow.amountLamports)}</span> SOL
        </span>
        <span>
          Receiver: <WalletAddress address={escrow.receiver} className="text-xs" />
        </span>
      </div>
      <AttestationProgress count={escrow.attestationCount} threshold={escrow.threshold} />
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Deadline: <Countdown targetUnix={Number(escrow.deadlineUnix)} /></span>
        {disputeEnd && (
          <span>Dispute: <Countdown targetUnix={disputeEnd} /></span>
        )}
      </div>
    </button>
  );
}
