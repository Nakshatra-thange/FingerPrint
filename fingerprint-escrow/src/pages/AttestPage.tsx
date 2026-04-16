import { useState } from "react";
import { useEscrowStore } from "@/store/escrowStore";
import { mockEscrows } from "@/data/mockEscrows";
import { StatusBadge } from "@/components/StatusBadge";
import { Countdown } from "@/components/Countdown";
import { WalletAddress } from "@/components/WalletAddress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink } from "lucide-react";
import { useFingerprintSDK } from "@/hooks/useFingerprintSDK";
function lamportsToSol(l: string) {
  return (Number(l) / 1e9).toFixed(2);
}

// Mock: assume first attestor is "us" for demo
const MY_ATTESTOR = "Att1...xY9z";

export default function AttestPage() {

  const [cidInputs, setCidInputs] = useState<Record<string, string>>({});
  const sdk = useFingerprintSDK();
const { walletAddress, setError } = useEscrowStore();
const [loading, setLoading] = useState<Record<string, boolean>>({});

// Replace MY_ATTESTOR constant:
const MY_ATTESTOR = walletAddress ?? "";

const handleAttest = async (escrowId: string) => {
  if (!sdk || !walletAddress) return;
  setLoading((p) => ({ ...p, [escrowId]: true }));
  try {
    const { PublicKey } = await import("@solana/web3.js");
    const sig = await sdk.attestation.submitAttestation({
      escrowId: BigInt(escrowId),
      attestor: new PublicKey(walletAddress),
      evidenceCid: cidInputs[escrowId] || undefined,
    });
    // Show explorer link via toast or inline
    console.log("Attested:", sig);
  } catch (err: any) {
    const { mapAnchorError } = await import("@/store/escrowStore");
    setError(mapAnchorError(err));
  } finally {
    setLoading((p) => ({ ...p, [escrowId]: false }));
  }
};

  if (!walletAddress) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-muted-foreground text-lg">Connect your wallet to view attestation requests.</p>
      </div>
    );
  }

  const myEscrows = mockEscrows.filter((e) => e.attestors.includes(MY_ATTESTOR));
  const pending = myEscrows.filter((e) => !e.attestedBy.includes(MY_ATTESTOR) && e.status === "active");
  const completed = myEscrows.filter((e) => e.attestedBy.includes(MY_ATTESTOR));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold mb-4">Pending Attestations</h1>
        {pending.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-8 text-center">
            <p className="text-muted-foreground">All caught up — no pending attestations.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pending.map((e) => (
              <div key={e.escrowId} className="rounded-lg border bg-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium line-clamp-2">{e.eventDescription}</p>
                  <StatusBadge status={e.status} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Payer: <WalletAddress address={e.payer} className="text-xs" /></span>
                  <span><span className="text-foreground font-medium">{lamportsToSol(e.amountLamports)}</span> SOL</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Deadline: <Countdown targetUnix={Number(e.deadlineUnix)} />
                </div>
                <div className="space-y-2">
                  <Input
                    value={cidInputs[e.escrowId] || ""}
                    onChange={(ev) => setCidInputs({ ...cidInputs, [e.escrowId]: ev.target.value })}
                    placeholder="Evidence CID (optional)"
                    className="font-mono text-sm"
                  />
                 <Button
  className="w-full"
  disabled={loading[e.escrowId]}
  onClick={() => handleAttest(e.escrowId)}
>
  {loading[e.escrowId] ? "Attesting…" : "Attest"}
</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Completed Attestations</h2>
        {completed.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-8 text-center">
            <p className="text-muted-foreground">You haven't attested to anything yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {completed.map((e) => (
              <div key={e.escrowId} className="rounded-lg border bg-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium line-clamp-2">{e.eventDescription}</p>
                  <StatusBadge status={e.status} />
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {e.evidenceCids[MY_ATTESTOR] && (
                    <p>Evidence: <span className="font-mono">{e.evidenceCids[MY_ATTESTOR]}</span></p>
                  )}
                  <p>Attested: Apr 12, 2026</p>
                  <a
                    href="https://explorer.solana.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    View on Explorer <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
