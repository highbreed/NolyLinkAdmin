/**
 * Session state, in memory only (no localStorage/sessionStorage) — lost on hard refresh by
 * design, same principle the original spec wanted for a JWT: a leaked/cached credential must
 * not survive outside an active tab.
 *
 * Real auth today is a single shared `X-Admin-Api-Key` (docs/api_reference.md) — there is no
 * per-admin login/JWT/MFA backend yet (admin_portal_design.md §4/§5.1 is a proposal, not
 * shipped — see docs/admin_portal_design.md's 2026-08-28 build note). `actingRole` lets the
 * UI exercise the RBAC nav-gating and route guards designed for that future backend against
 * MSW mocks; it is NOT a real security boundary — anyone with the shared key can already do
 * everything the real backend allows regardless of what's picked here.
 */
import { create } from "zustand";
import type { AdminRole } from "@/api/types";

interface SessionState {
  apiKey: string | null;
  actingRole: AdminRole;
  setSession: (apiKey: string, actingRole: AdminRole) => void;
  setActingRole: (role: AdminRole) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  apiKey: null,
  actingRole: "SUPERADMIN",
  setSession: (apiKey, actingRole) => set({ apiKey, actingRole }),
  setActingRole: (actingRole) => set({ actingRole }),
  clearSession: () => set({ apiKey: null }),
}));

export function isAuthenticated(): boolean {
  return useSessionStore.getState().apiKey !== null;
}
