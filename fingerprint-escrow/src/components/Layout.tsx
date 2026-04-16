import { Outlet, NavLink } from "react-router-dom";
import { useEscrowStore } from "@/store/escrowStore";
import { Button } from "@/components/ui/button";
import { Fingerprint } from "lucide-react";
import { MOCK_WALLET } from "@/data/mockEscrows";

export function Layout() {
  const { walletAddress, setWallet } = useEscrowStore();

  const handleConnect = () => {
    if (walletAddress) {
      setWallet(null);
    } else {
      setWallet(MOCK_WALLET);
    }
  };

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
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <Button
            onClick={handleConnect}
            variant={walletAddress ? "outline" : "default"}
            size="sm"
            className={walletAddress ? "font-mono text-xs" : ""}
          >
            {walletAddress ? walletAddress : "Connect Wallet"}
          </Button>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="md:hidden sticky top-14 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="container flex gap-1 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-1 text-center px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}
