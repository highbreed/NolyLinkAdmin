import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import "@/index.css";

/**
 * MSW mocks are ON by default so the app is fully click-through-able with no backend running
 * (see docs/frontend_README.md). Set VITE_ENABLE_MOCKS=false once VITE_API_BASE_URL points at
 * a real running gateway.
 */
async function prepare() {
  if (import.meta.env.VITE_ENABLE_MOCKS === "false") return;
  const { worker } = await import("@/mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}

prepare().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
