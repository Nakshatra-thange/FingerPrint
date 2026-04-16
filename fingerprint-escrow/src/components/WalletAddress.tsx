export function WalletAddress({ address, className = "" }: { address: string; className?: string }) {
  return (
    <span className={`font-mono text-sm ${className}`} title={address}>
      {address}
    </span>
  );
}
