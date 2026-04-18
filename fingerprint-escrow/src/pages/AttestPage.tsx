import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { Countdown } from "@/components/Countdown";
import { StatusBadge } from "@/components/StatusBadge";
import { WalletAddress } from "@/components/WalletAddress";
import { useFingerprintSDK } from "@/hooks/useFingerprintSDK";
import { mapAnchorError, useEscrowStore } from "@/store/escrowStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";

const INDEXER = import.meta.env.VITE_INDEXER_URL ?? "http://localhost:3001";

interface AttestorEscrowRow {
  escrow_id: string;
  payer: string;
  receiver: string;
  event_description: string;
  amount_lamports: string;
  threshold: number;
  attestation_count: number;
  status: string;
  deadline_unix: string;
  dispute_window_seconds: string;
  my_evidence_cid: string | null;
  my_tx_signature: string | null;
  my_timestamp_unix: string | null;
  my_attested: boolean;
}

function lamportsToSol(lamports: string) {
  return (Number(lamports) / 1e9).toFixed(2);
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export default function AttestPage() {
  const sdk = useFingerprintSDK();
  const { setError, setSuccess, walletAddress } = useEscrowStore();

  const [rows, setRows] = useState<AttestorEscrowRow[]>([]);
  const [loadingPage, setLoadingPage] = useState(false);
  const [loadingTx, setLoadingTx] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [cidInputs, setCidInputs] = useState<Record<string, string>>({});

  const loadEscrows = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingPage(true);
    try {
      const response = await fetch(`${INDEXER}/api/escrows/by-attestor/${walletAddress}`);
      if (!response.ok) {
        throw new Error("Failed to load attestor escrows");
      }

      const payload = (await response.json()) as { escrows: AttestorEscrowRow[] };
      setRows(payload.escrows);
      setCidInputs(
        Object.fromEntries(
          payload.escrows.map((row) => [row.escrow_id, row.my_evidence_cid ?? ""])
        )
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load attestor escrows.");
    } finally {
      setLoadingPage(false);
    }
  }, [setError, setRows, setCidInputs, walletAddress]);

  useEffect(() => {
    void loadEscrows();
  }, [loadEscrows]);

  const pending = useMemo(
    () => rows.filter((row) => !row.my_attested && row.status === "active"),
    [rows]
  );
  const completed = useMemo(() => rows.filter((row) => row.my_attested), [rows]);

  async function handleUpload(escrowId: string, file: File) {
    setUploading((current) => ({ ...current, [escrowId]: true }));
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

      setCidInputs((current) => ({ ...current, [escrowId]: payload.cid ?? "" }));
      setSuccess(`Evidence uploaded for escrow ${escrowId}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Evidence upload failed.");
    } finally {
      setUploading((current) => ({ ...current, [escrowId]: false }));
    }
  }

  async function handleAttest(escrowId: string) {
    if (!sdk || !walletAddress) return;

    setLoadingTx((current) => ({ ...current, [escrowId]: true }));
    setError(null);

    try {
      const signature = await sdk.attestation.submitAttestation({
        escrowId: BigInt(escrowId),
        attestor: new PublicKey(walletAddress),
        evidenceCid: cidInputs[escrowId] || undefined,
      });

      setSuccess(`Attestation submitted: ${signature}`);
      await loadEscrows();
    } catch (error) {
      setError(mapAnchorError(error));
    } finally {
      setLoadingTx((current) => ({ ...current, [escrowId]: false }));
    }
  }

  if (!walletAddress) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg text-muted-foreground">
          Connect your wallet to view attestation requests.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-2xl font-bold">Pending Attestations</h1>
        {loadingPage ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">Loading attestation requests...</p>
          </div>
        ) : pending.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-8 text-center">
            <p className="text-muted-foreground">No pending attestations.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pending.map((row) => (
              <div key={row.escrow_id} className="space-y-3 rounded-lg border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium line-clamp-2">{row.event_description}</p>
                  <StatusBadge status={row.status as "active"} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Payer: <WalletAddress address={row.payer} className="text-xs" />
                  </span>
                  <span>
                    <span className="font-medium text-foreground">
                      {lamportsToSol(row.amount_lamports)}
                    </span>{" "}
                    SOL
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Deadline: <Countdown targetUnix={Number(row.deadline_unix)} />
                </div>
                <div className="space-y-2">
                  <Input
                    value={cidInputs[row.escrow_id] ?? ""}
                    onChange={(event) =>
                      setCidInputs((current) => ({
                        ...current,
                        [row.escrow_id]: event.target.value,
                      }))
                    }
                    placeholder="Evidence CID (optional)"
                    className="font-mono text-sm"
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-primary">
                    <Upload className="h-4 w-4" />
                    {uploading[row.escrow_id] ? "Uploading..." : "Upload evidence"}
                    <input
                      type="file"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void handleUpload(row.escrow_id, file);
                        }
                      }}
                    />
                  </label>
                  <Button
                    className="w-full"
                    disabled={loadingTx[row.escrow_id]}
                    onClick={() => void handleAttest(row.escrow_id)}
                  >
                    {loadingTx[row.escrow_id] ? "Attesting..." : "Attest"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Completed Attestations</h2>
        {completed.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-8 text-center">
            <p className="text-muted-foreground">No completed attestations yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {completed.map((row) => (
              <div key={row.escrow_id} className="space-y-3 rounded-lg border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium line-clamp-2">{row.event_description}</p>
                  <StatusBadge status={row.status as "active"} />
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {row.my_evidence_cid && (
                    <p>
                      Evidence CID: <span className="font-mono">{row.my_evidence_cid}</span>
                    </p>
                  )}
                  {row.my_timestamp_unix && (
                    <p>
                      Attested at:{" "}
                      {new Date(Number(row.my_timestamp_unix) * 1000).toLocaleString()}
                    </p>
                  )}
                  {row.my_tx_signature && (
                    <p className="font-mono">Signature: {row.my_tx_signature}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
