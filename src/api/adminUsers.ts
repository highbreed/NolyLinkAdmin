/**
 * Real endpoints, confirmed against the live backend (2026-08-31): `POST /admin/users`,
 * `GET /admin/users`, `POST /admin/users/{id}/deactivate`, `POST /admin/users/{id}/reactivate`.
 * No role/email/MFA fields exist server-side — see api/types.ts's AdminUser.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { AdminUser, CreateAdminUserRequest } from "@/api/types";

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiRequest<AdminUser[]>("/admin/users"),
  });
}

export function useCreateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAdminUserRequest) =>
      apiRequest<AdminUser>("/admin/users", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useDeactivateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<AdminUser>(`/admin/users/${id}/deactivate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useReactivateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<AdminUser>(`/admin/users/${id}/reactivate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}
