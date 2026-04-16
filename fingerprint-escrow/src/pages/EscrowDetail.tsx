import { useParams, Link } from "react-router-dom";
import { mockEscrows, getMockDetail } from "@/data/mockEscrows";
import { useEscrowStore } from "@/store/escrowStore";
import { StatusBadge } from "@/components/StatusBadge";
import { AttestationProgress } from "@/components/AttestationProgress";
import { Countdown } from "@/components/Countdown";
import { WalletAddress } from "@/components/WalletAddress";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, ExternalLink } from "lucide-react";

function lamportsToSol(l: string) {
  return (Number(l) / 1e9).toFixed(2);
}

export default function EscrowDetail() {
  const { id } = useParams<{ id: string }>();
  const { releaseFunds } = useEscrowStore();
  const summary = mockEscrows.find((e) => e.escrowId === id);

  if (!summary) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground text-lg">Escrow not found.</p>
        <Link to="/explorer" className="text-primary hover:underline text-sm mt-2 inline-block">
          Back to Explorer
        </Link>
      </div>
    );
  }

  const detail = getMockDetail(summary);
  const disputeEnd = detail.thresholdMetAt
    ? Number(detail.thresholdMetAt) + Number(detail.disputeWindowSeconds)
    : null;
  const disputeExpired = disputeEnd ? disputeEnd < Date.now() / 1000 : false;
  const canRelease = detail.status === "thresholdMet" && disputeExpired;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/explorer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="rounded-lg border bg-card p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold mb-1">{detail.eventDescription}</h1>
            <p className="text-xs font-mono text-muted-foreground">{detail.escrowId}</p>
          </div>
          <StatusBadge status={detail.status} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-1">Payer</p>
            <WalletAddress address={detail.payer} />
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Receiver</p>
            <WalletAddress address={detail.receiver} />
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Amount</p>
            <p className="font-medium">{lamportsToSol(detail.amountLamports)} SOL</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Deadline</p>
            <Countdown targetUnix={Number(detail.deadlineUnix)} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Attestation Progress</p>
          <AttestationProgress count={detail.attestationCount} threshold={detail.threshold} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Attestors</p>
          <div className="space-y-2">
            {detail.attestorDetails.map((a) => (
              <div key={a.address} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                <div className="flex items-center gap-2">
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center ${a.attested ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {a.attested && <Check className="h-3 w-3" />}
                  </div>
                  <WalletAddress address={a.address} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {a.evidenceCid && <span className="font-mono">{a.evidenceCid}</span>}
                  {a.txSignature && (
                    <a href="https://explorer.solana.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      tx <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {disputeEnd && (
          <div className="flex items-center justify-between py-3 px-4 rounded-md bg-muted/50">
            <span className="text-sm">Dispute Window</span>
            <Countdown targetUnix={disputeEnd} />
          </div>
        )}

        <div className="flex gap-3">
          {canRelease && (
            <Button onClick={() => releaseFunds(detail.escrowId)} className="flex-1">
              Release Funds
            </Button>
          )}
          <Button variant="outline" asChild>
            <a href="https://explorer.solana.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
              View on Explorer <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
