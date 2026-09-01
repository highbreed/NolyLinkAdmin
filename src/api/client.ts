/**
 * Single typed HTTP client. Every request goes through here so that:
 *  - the admin JWT is attached centrally as `Authorization: Bearer <token>` (never inlined
 *    per-call) — this is the real credential the backend's require_admin dependency checks
 *    (app/core/admin_auth.py), issued by the real POST /admin/login (confirmed 2026-08-31)
 *  - a 401/403 centrally triggers the "session lost" flow (see auth/session-store.ts) — the
 *    backend has no refresh-token endpoint, so this always means a forced re-login, never a
 *    silent refresh
 *  - errors are a consistent, typed shape components can branch on
 *
 * In dev, requests go through Vite's proxy (vite.config.ts) to the real backend so they stay
 * same-origin (the backend has no CORS middleware) — so VITE_API_BASE_URL is normally left
 * unset locally; it exists for a prod build served from a different origin than the API,
 * where the deployment's own reverse proxy/CORS config is expected to make it work.
 */
import { useSessionStore } from "@/auth/session-store";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Most endpoints return `{"detail": "some string"}` on error, but FastAPI's own request-level
 * validation (a Pydantic model_validator raising, confirmed on POST /v1/customers/onboard's
 * VSCU base_url check) returns `{"detail": [{"msg": "...", "loc": [...], ...}, ...]}` instead —
 * an array of error objects, not a string. Rendering that array directly as a string/JSX child
 * would show "[object Object]" or crash React outright, so this normalizes both shapes.
 */
function extractDetail(data: unknown, fallback: string): string {
  if (typeof data !== "object" || data === null || !("detail" in data)) return fallback;
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => (typeof e === "object" && e !== null && "msg" in e ? String((e as { msg: unknown }).msg) : JSON.stringify(e)))
      .join("; ");
  }
  return fallback;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path, API_BASE_URL || window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return API_BASE_URL ? url.toString() : url.pathname + url.search;
}

export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const { method = "GET", body, query } = options;
  const accessToken = useSessionStore.getState().accessToken;

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 || response.status === 403) {
    useSessionStore.getState().clearSession();
    let detail = "Session expired — please sign in again.";
    try {
      detail = extractDetail(await response.json(), detail);
    } catch {
      /* no JSON body */
    }
    throw new ApiError(response.status, detail);
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      detail = extractDetail(await response.json(), detail);
    } catch {
      /* no JSON body */
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }
  return (await response.json()) as TResponse;
}
