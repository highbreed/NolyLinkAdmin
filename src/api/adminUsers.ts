/** Mocked-only — admin_portal_design.md §5.1, no real backend yet (Superadmin only). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { AdminRole, AdminUser } from "@/api/types";

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiRequest<AdminUser[]>("/admin/api/v1/admin-users"),
  });
}

export function useCreateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: AdminRole }) =>
      apiRequest<AdminUser>("/admin/api/v1/admin-users", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useUpdateAdminUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { role?: AdminRole; is_active?: boolean }) =>
      apiRequest<AdminUser>(`/admin/api/v1/admin-users/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useResetAdminUserPassword(id: string) {
  return useMutation({
    mutationFn: () =>
      apiRequest<{ ok: true }>(`/admin/api/v1/admin-users/${id}/reset-password`, { method: "POST" }),
  });
}
