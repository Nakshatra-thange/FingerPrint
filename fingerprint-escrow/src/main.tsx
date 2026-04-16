import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter,  } from "@solana/wallet-adapter-wallets";
import { useMemo } from "react";
import { clusterApiUrl } from "@solana/web3.js";

import { Buffer } from "buffer";
import process from "process";

(window as any).Buffer = Buffer;
(window as any).process = process;

const RPC_URL = import.meta.env.VITE_RPC_URL ?? clusterApiUrl("devnet");
const wallets = [new PhantomWalletAdapter()];

createRoot(document.getElementById("root")!).render(
  <ConnectionProvider endpoint={RPC_URL}>
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <App />
      </WalletModalProvider>
    </WalletProvider>
  </ConnectionProvider>
);