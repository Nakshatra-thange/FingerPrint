import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WalletAddress } from "@/components/WalletAddress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { EscrowStatus, EscrowSummary } from "@/types/escrow";
import { dbRowToSummary } from "@/store/escrowStore"; // ✅ import mapper

function lamportsToSol(l: string) {
  return (Number(l) / 1e9).toFixed(2);
}

const PAGE_SIZE = 10;

const STATUSES: { value: string; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "thresholdMet", label: "Threshold Met" },
  { value: "disputed", label: "Disputed" },
  { value: "released", label: "Released" },
  { value: "refunded", label: "Refunded" },
];

const INDEXER =
  import.meta.env.VITE_INDEXER_URL ?? "http://localhost:3001";

export default function Explorer() {
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);

  // ✅ NEW: fetched data
  const [allEscrows, setAllEscrows] = useState<EscrowSummary[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // ✅ Fetch from indexer
  useEffect(() => {
    const url =
      statusFilter === "all"
        ? `${INDEXER}/api/escrows?limit=100`
        : `${INDEXER}/api/escrows?status=${statusFilter}&limit=100`;

    setLoadingData(true);

    fetch(url)
      .then((r) => r.json())
      .then(({ escrows }) =>
        setAllEscrows(escrows.map(dbRowToSummary))
      )
      .catch(() => setAllEscrows([]))
      .finally(() => setLoadingData(false));
  }, [statusFilter]);

  // ✅ No more mock filtering
  const filtered = useMemo(() => allEscrows, [allEscrows]);

  const paged = filtered.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Explorer</h1>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ✅ Loading state */}
      {loadingData ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">Loading escrows...</p>
        </div>
      ) : paged.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-8 text-center">
          <p className="text-muted-foreground">
            No escrows match this filter.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left p-3 font-medium">ID</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">
                  Description
                </th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">
                  Payer
                </th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">
                  Receiver
                </th>
                <th className="text-right p-3 font-medium">Amount</th>
                <th className="text-center p-3 font-medium">
                  Progress
                </th>
                <th className="text-center p-3 font-medium">
                  Status
                </th>
                <th className="text-right p-3 font-medium hidden md:table-cell">
                  Created
                </th>
              </tr>
            </thead>

            <tbody>
              {paged.map((e) => (
                <tr
                  key={e.escrowId}
                  onClick={() =>
                    navigate(`/escrow/${e.escrowId}`)
                  }
                  className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="p-3 font-mono text-xs">
                    {e.escrowId}
                  </td>

                  <td className="p-3 hidden md:table-cell max-w-[200px] truncate">
                    {e.eventDescription}
                  </td>

                  <td className="p-3 hidden lg:table-cell">
                    <WalletAddress
                      address={e.payer}
                      className="text-xs"
                    />
                  </td>

                  <td className="p-3 hidden lg:table-cell">
                    <WalletAddress
                      address={e.receiver}
                      className="text-xs"
                    />
                  </td>

                  <td className="p-3 text-right font-medium">
                    {lamportsToSol(e.amountLamports)}
                  </td>

                  <td className="p-3 text-center font-mono text-xs">
                    {e.attestationCount}/{e.threshold}
                  </td>

                  <td className="p-3 text-center">
                    <span className="flex items-center justify-center gap-1.5 text-xs">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          e.status === "active"
                            ? "bg-status-active"
                            : e.status === "thresholdMet"
                            ? "bg-status-threshold"
                            : e.status === "disputed"
                            ? "bg-status-disputed"
                            : e.status === "released"
                            ? "bg-status-released"
                            : "bg-status-refunded"
                        }`}
                      />
                      {e.status === "thresholdMet"
                        ? "Threshold"
                        : e.status.charAt(0).toUpperCase() +
                          e.status.slice(1)}
                    </span>
                  </td>

                  <td className="p-3 text-right text-xs text-muted-foreground hidden md:table-cell">
                    {new Date(e.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
          >
            Previous
          </Button>

          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages - 1}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}