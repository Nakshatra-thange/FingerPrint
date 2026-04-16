import type { EscrowStatus } from "@/types/escrow";

const statusConfig: Record<EscrowStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-status-active/15 text-status-active" },
  thresholdMet: { label: "Threshold Met", className: "bg-status-threshold/15 text-status-threshold" },
  disputed: { label: "Disputed", className: "bg-status-disputed/15 text-status-disputed" },
  released: { label: "Released", className: "bg-status-released/15 text-status-released" },
  refunded: { label: "Refunded", className: "bg-status-refunded/15 text-status-refunded" },
};

export function StatusBadge({ status }: { status: EscrowStatus }) {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
