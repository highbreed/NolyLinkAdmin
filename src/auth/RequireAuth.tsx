import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSessionStore } from "@/auth/session-store";

export function RequireAuth() {
  const apiKey = useSessionStore((s) => s.apiKey);
  const location = useLocation();

  if (!apiKey) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
