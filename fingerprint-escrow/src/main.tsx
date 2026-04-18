import { createRoot } from "react-dom/client";
import { AppProviders } from "./AppProviders.tsx";
import "./index.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Buffer } from "buffer";
import process from "process";

declare global {
  interface Window {
    Buffer: typeof Buffer;
    process: typeof process;
  }
}

window.Buffer = Buffer;
window.process = process;

createRoot(document.getElementById("root")!).render(
  <AppProviders />
);
