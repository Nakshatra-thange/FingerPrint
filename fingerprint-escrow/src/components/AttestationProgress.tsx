interface Props {
  count: number;
  threshold: number;
}

export function AttestationProgress({ count, threshold }: Props) {
  const pct = Math.min((count / threshold) * 100, 100);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-mono text-muted-foreground whitespace-nowrap">
        {count} / {threshold}
      </span>
    </div>
  );
}
