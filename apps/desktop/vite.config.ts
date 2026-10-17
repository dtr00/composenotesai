import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;
const TAURI_DEV_PORT = 1420;

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  build: {
    rolldownOptions: {
      input: {
        main: path.resolve(import.meta.dirname, "index.html"),
        voiceOverlay: path.resolve(import.meta.dirname, "voice-overlay.html"),
      },
    },
  },
  clearScreen: false,
  server: {
    port: TAURI_DEV_PORT,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: TAURI_DEV_PORT + 1 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
