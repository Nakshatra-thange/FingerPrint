import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { Link, useParams } from "react-router-dom";
import { DISPUTE_RESOLVER } from "../../../sdk/src/constants";
import { AttestationProgress } from "@/components/AttestationProgress";
import { Countdown } from "@/components/Countdown";
import { SkeletonCard } from "@/components/SkeletonCard";
import { StatusBadge } from "@/components/StatusBadge";
import { WalletAddress } from "@/components/WalletAddress";
import { useFingerprintSDK } from "@/hooks/useFingerprintSDK";
import { mapAnchorError, useEscrowStore } from "@/store/escrowStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, Upload } from "lucide-react";

const INDEXER = import.meta.env.VITE_INDEXER_URL ?? "http://localhost:3001";

function lamportsToSol(lamports: string) {
  return (Number(lamports) / 1e9).toFixed(2);
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  for (const byte of new Uint8Array(buffer)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export default function EscrowDetail() {
  const { id } = useParams<{ id: string }>();
  const sdk = useFingerprintSDK();
  const {
    activeEscrow,
    fetchEscrowDetail,
    isLoading,
    setError,
    setSuccess,
    walletAddress,
  } = useEscrowStore();

  const [reason, setReason] = useState("");
  const [counterEvidenceCid, setCounterEvidenceCid] = useState("");
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (id) {
      void fetchEscrowDetail(id);
    }
  }, [fetchEscrowDetail, id]);

  const detail = activeEscrow?.escrowId === id ? activeEscrow : null;

  async function refresh() {
    if (id) {
      await fetchEscrowDetail(id);
    }
  }

  async function handleEvidenceUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const response = await fetch(`${INDEXER}/api/evidence/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          dataBase64: await fileToBase64(file),
        }),
      });

      const payload = (await response.json()) as { cid?: string; error?: string };
      if (!response.ok || !payload.cid) {
        throw new Error(payload.error ?? "Upload failed");
      }

      setCounterEvidenceCid(payload.cid);
      setSuccess(`Evidence uploaded: ${payload.cid}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Evidence upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleOpenDispute() {
    if (!sdk || !detail) return;

    setWorking(true);
    setError(null);
    try {
      await sdk.dispute.openDispute({
        escrowId: BigInt(detail.escrowId),
        reason,
        counterEvidenceCid: counterEvidenceCid || undefined,
      });
      setReason("");
      setCounterEvidenceCid("");
      setSuccess(`Dispute opened for escrow ${detail.escrowId}.`);
      await refresh();
    } catch (error) {
      setError(mapAnchorError(error));
    } finally {
      setWorking(false);
    }
  }

  async function handleResolve(releaseToReceiver: boolean) {
    if (!sdk || !detail) return;

    setWorking(true);
    setError(null);
    try {
      await sdk.dispute.resolveDispute({
        escrowId: BigInt(detail.escrowId),
        releaseToReceiver,
        resolverNotes: reason || undefined,
      });
      setReason("");
      setSuccess(
        releaseToReceiver
          ? `Dispute resolved for receiver on escrow ${detail.escrowId}.`
          : `Dispute resolved for payer on escrow ${detail.escrowId}.`
      );
      await refresh();
    } catch (error) {
      setError(mapAnchorError(error));
    } finally {
      setWorking(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4">
        {[0, 1, 2].map((index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (!detail) {
    return <p className="text-muted-foreground">Escrow not found.</p>;
  }

  const disputeEnd = detail.thresholdMetAt
    ? Number(detail.thresholdMetAt) + Number(detail.disputeWindowSeconds)
    : null;
  const disputeExpired = disputeEnd ? disputeEnd < Date.now() / 1000 : false;
  const resolverMode = walletAddress === DISPUTE_RESOLVER.toBase58();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to="/explorer"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="space-y-5 rounded-lg border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="mb-1 text-xl font-bold">{detail.eventDescription}</h1>
            <p className="text-xs font-mono text-muted-foreground">{detail.escrowId}</p>
          </div>
          <StatusBadge status={detail.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Payer</p>
            <WalletAddress address={detail.payer} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Receiver</p>
            <WalletAddress address={detail.receiver} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Amount</p>
            <p className="font-medium">{lamportsToSol(detail.amountLamports)} SOL</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Deadline</p>
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
            {detail.attestorDetails.map((attestor) => (
              <div
                key={attestor.address}
                className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${
                      attestor.attested
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {attestor.attested && <Check className="h-3 w-3" />}
                  </div>
                  <WalletAddress address={attestor.address} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {attestor.evidenceCid && (
                    <span className="font-mono">{attestor.evidenceCid}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {disputeEnd && (
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-3">
            <span className="text-sm">Dispute Window</span>
            <Countdown targetUnix={disputeEnd} />
          </div>
        )}

        {detail.status === "thresholdMet" && disputeExpired && (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
            Threshold met and dispute window ended. The backend worker will release funds automatically.
          </div>
        )}

        {detail.dispute && (
          <div className="space-y-2 rounded-md border border-status-disputed/30 bg-status-disputed/10 p-4">
            <p className="font-medium">Dispute</p>
            <p className="text-sm text-muted-foreground">{detail.dispute.reason}</p>
            <p className="text-xs text-muted-foreground">
              Opened by <WalletAddress address={detail.dispute.disputer} className="text-xs" />
            </p>
            {detail.dispute.counterEvidenceCid && (
              <p className="text-xs font-mono text-muted-foreground">
                CID: {detail.dispute.counterEvidenceCid}
              </p>
            )}
            {detail.dispute.resolverNotes && (
              <p className="text-sm text-muted-foreground">
                Resolver notes: {detail.dispute.resolverNotes}
              </p>
            )}
          </div>
        )}

        {detail.status === "thresholdMet" && !disputeExpired && walletAddress && (
          <div className="space-y-3 rounded-md border p-4">
            <p className="font-medium">Open Dispute</p>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value.slice(0, 512))}
              placeholder="Explain why the payout should be challenged."
              rows={4}
            />
            <Input
              value={counterEvidenceCid}
              onChange={(event) => setCounterEvidenceCid(event.target.value)}
              placeholder="Counter evidence CID (optional)"
              className="font-mono text-sm"
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-primary">
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading..." : "Upload counter evidence"}
              <input
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleEvidenceUpload(file);
                  }
                }}
              />
            </label>
            <Button disabled={working || !reason.trim()} onClick={() => void handleOpenDispute()}>
              {working ? "Opening..." : "Open Dispute"}
            </Button>
          </div>
        )}

        {detail.status === "disputed" && resolverMode && (
          <div className="space-y-3 rounded-md border p-4">
            <p className="font-medium">Resolver Actions</p>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value.slice(0, 512))}
              placeholder="Resolver notes"
              rows={3}
            />
            <div className="flex gap-3">
              <Button
                disabled={working}
                onClick={() => void handleResolve(true)}
                className="flex-1"
              >
                {working ? "Resolving..." : "Release to Receiver"}
              </Button>
              <Button
                variant="outline"
                disabled={working}
                onClick={() => void handleResolve(false)}
                className="flex-1"
              >
                {working ? "Resolving..." : "Refund to Payer"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
