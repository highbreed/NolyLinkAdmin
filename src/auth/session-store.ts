/**
 * Session state, in memory only (no localStorage/sessionStorage) — lost on hard refresh by
 * design: a leaked/cached credential must not survive outside an active tab. There is no
 * refresh-token endpoint on the backend, so a hard refresh means a real re-login, not silent
 * restoration — see docs/frontend_README.md.
 *
 * Real auth (confirmed against the live backend 2026-08-31): `POST /admin/login`
 * (username/password) issues a JWT `access_token`, sent as `Authorization: Bearer <token>` on
 * every subsequent request (src/api/client.ts). No MFA, no roles on the backend.
 *
 * `actingRole` lets the UI exercise the RBAC nav-gating/route guards from
 * admin_portal_design.md §2 ahead of a real roles column existing — it is NOT a real security
 * boundary; any logged-in admin can already do everything the real backend allows regardless
 * of what's picked here.
 */
import { create } from "zustand";
import type { AdminRole } from "@/api/types";

interface SessionState {
  accessToken: string | null;
  username: string | null;
  actingRole: AdminRole;
  setSession: (accessToken: string, username: string, actingRole: AdminRole) => void;
  setActingRole: (role: AdminRole) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  username: null,
  actingRole: "SUPERADMIN",
  setSession: (accessToken, username, actingRole) => set({ accessToken, username, actingRole }),
  setActingRole: (actingRole) => set({ actingRole }),
  clearSession: () => set({ accessToken: null, username: null }),
}));

export function isAuthenticated(): boolean {
  return useSessionStore.getState().accessToken !== null;
}
