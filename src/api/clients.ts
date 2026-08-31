/**
 * Mocked-only: no real `/admin/api/v1/clients` backend yet (admin_portal_design.md §5.2
 * proposal). Served by src/mocks/handlers.ts until that backend ships.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { Client, ClientSecretOnce, CreateClientRequest, Page, SortParam } from "@/api/types";

export interface ClientListParams {
  page: number;
  pageSize: number;
  sort: SortParam | null;
  search: string;
  status?: string;
}

export function useClientsList(params: ClientListParams) {
  return useQuery({
    queryKey: ["clients", params],
    queryFn: () =>
      apiRequest<Page<Client>>("/admin/api/v1/clients", {
        query: {
          page: params.page,
          page_size: params.pageSize,
          sort: params.sort ? `${params.sort.desc ? "-" : ""}${params.sort.id}` : undefined,
          q: params.search || undefined,
          status: params.status,
        },
      }),
  });
}

export function useClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => apiRequest<Client>(`/admin/api/v1/clients/${clientId}`),
    enabled: !!clientId,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateClientRequest) =>
      apiRequest<ClientSecretOnce>("/admin/api/v1/clients", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useRotateClientSecret(clientId: string) {
  return useMutation({
    mutationFn: () =>
      apiRequest<ClientSecretOnce>(`/admin/api/v1/clients/${clientId}/rotate-secret`, {
        method: "POST",
      }),
  });
}

export function useAttachBranch(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branchCode: string) =>
      apiRequest<Client>(`/admin/api/v1/clients/${clientId}/branches`, {
        method: "POST",
        body: { branch_code: branchCode },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients", clientId] }),
  });
}
