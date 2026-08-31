import { Navigate, Outlet } from "react-router-dom";
import { useSessionStore } from "@/auth/session-store";
import type { AdminRole } from "@/api/types";

interface RequireRoleProps {
  roles: AdminRole[];
}

/**
 * Route guard for the RBAC role table (admin_portal_design.md §2). Gated on `actingRole`,
 * which is a UI-only stand-in until the real `/admin/api/v1/auth` + `admin_users` backend
 * exists (see session-store.ts) — this guard still redirects for real, it just isn't backed
 * by a real per-user identity yet.
 */
export function RequireRole({ roles }: RequireRoleProps) {
  const actingRole = useSessionStore((s) => s.actingRole);

  if (!roles.includes(actingRole)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
