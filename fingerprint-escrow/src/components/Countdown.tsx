import { useState } from "react";
import { useInterval } from "@/hooks/useInterval";

function formatTime(seconds: number): string {
  if (seconds <= 0) return "Expired";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function Countdown({ targetUnix }: { targetUnix: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetUnix - Math.floor(Date.now() / 1000)));

  useInterval(() => {
    setRemaining(Math.max(0, targetUnix - Math.floor(Date.now() / 1000)));
  }, 1000);

  return (
    <span className={`font-mono text-sm ${remaining <= 0 ? "text-status-disputed" : "text-muted-foreground"}`}>
      {formatTime(remaining)}
    </span>
  );
}
