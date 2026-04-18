import { Outlet, NavLink } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEscrowStore } from "@/store/escrowStore";
import { Fingerprint } from "lucide-react";
import { useEffect } from "react";

export function Layout() {
  const { publicKey } = useWallet();
  const { error, setError, setSuccess, setWallet, success } = useEscrowStore();

  // Keep store in sync with real wallet
  useEffect(() => {
    setWallet(publicKey?.toBase58() ?? null);
  }, [publicKey, setWallet]);

  const navItems = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/attest", label: "Attest" },
    { to: "/explorer", label: "Explorer" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <NavLink to="/" className="flex items-center gap-2 text-primary">
              <Fingerprint className="h-6 w-6" />
              <span className="text-lg font-bold tracking-tight">Fingerprint</span>
            </NavLink>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          {/* WalletMultiButton handles connect/disconnect/modal automatically */}
          <WalletMultiButton style={{ height: "36px", fontSize: "14px" }} />
        </div>
      </header>

      <nav className="md:hidden sticky top-14 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="container flex gap-1 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-1 text-center px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="container py-6">
        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <div className="flex items-center justify-between gap-4">
              <span>{error}</span>
              <button
                className="text-xs underline"
                onClick={() => setError(null)}
                type="button"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
            <div className="flex items-center justify-between gap-4">
              <span>{success}</span>
              <button
                className="text-xs underline"
                onClick={() => setSuccess(null)}
                type="button"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
