import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },

  plugins: [react()].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),

      // ✅ FIX: resolve manually for ESM
      crypto: path.resolve(__dirname, "node_modules/crypto-browserify"),
      stream: path.resolve(__dirname, "node_modules/stream-browserify"),
      buffer: path.resolve(__dirname, "node_modules/buffer"),
      process: path.resolve(__dirname, "node_modules/process/browser.js"),
      "process/": path.resolve(__dirname, "node_modules/process/browser.js"),
    },

    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },

  define: {
    global: "globalThis",
  },

  optimizeDeps: {
    include: [
      "buffer",
      "process",
      "crypto-browserify",
      "stream-browserify",
    ],
  },
}));