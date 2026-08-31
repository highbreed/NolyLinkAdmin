import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSessionStore } from "@/auth/session-store";

export function RequireAuth() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const location = useLocation();

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
