/**
 * Single typed HTTP client. Every request goes through here so that:
 *  - the admin API key is attached centrally (never inlined per-call)
 *  - a 401/403 centrally triggers the "session lost" flow (see auth/session-store.ts)
 *  - errors are a consistent, typed shape components can branch on
 *
 * Real backend base: VITE_API_BASE_URL (docs/frontend_README.md documents the split between
 * routes that hit this for real — /v1/devices/initialize, /v1/billing/* — and routes that
 * are MSW-mocked-only because the /admin/api/v1/* backend in admin_portal_design.md hasn't
 * been built yet).
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
  const apiKey = useSessionStore.getState().apiKey;

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-Admin-Api-Key": apiKey } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 || response.status === 403) {
    useSessionStore.getState().clearSession();
    let detail = "Session expired or admin key rejected.";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? detail;
    } catch {
      /* no JSON body */
    }
    throw new ApiError(response.status, detail);
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? detail;
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
