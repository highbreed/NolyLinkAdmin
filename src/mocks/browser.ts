import { setupWorker } from "msw/browser";
import { realHandlers, mockOnlyHandlers } from "@/mocks/handlers";

/**
 * When VITE_USE_REAL_BACKEND=true, real-shaped requests (login, admin users, device init,
 * billing) are left unregistered here so MSW's onUnhandledRequest:"bypass" lets them travel
 * on to the real gateway (via Vite's dev-server proxy — see vite.config.ts) instead of being
 * answered by the mock. Everything else (the /admin/api/v1/* proposal with no real backend
 * yet) stays mocked either way, so the rest of the app stays click-through-able.
 */
const hasRealBackend = import.meta.env.VITE_USE_REAL_BACKEND === "true";

export const worker = setupWorker(...(hasRealBackend ? [] : realHandlers), ...mockOnlyHandlers);
