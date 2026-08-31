import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  // BACKEND_PROXY_TARGET is deliberately NOT VITE_-prefixed — it's a dev-server-only value
  // (where to proxy /v1, /admin, /oauth to), never exposed to the client bundle. The client
  // bundle's own "is there a real backend" signal is the separate VITE_USE_REAL_BACKEND flag
  // (src/mocks/browser.ts) — kept apart specifically so the client never learns a real origin
  // to build cross-origin URLs against; it only ever fetches same-origin relative paths, which
  // this proxy then forwards server-side. The backend has no CORS middleware, so a same-origin
  // proxy (rather than an absolute cross-origin fetch) is what actually works in a browser.
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = env.BACKEND_PROXY_TARGET || "http://localhost:8010";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/v1": { target: backendTarget, changeOrigin: true },
        "/admin": { target: backendTarget, changeOrigin: true },
        "/oauth": { target: backendTarget, changeOrigin: true },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: true,
      exclude: ["**/node_modules/**", "**/e2e/**"],
    },
  };
});
