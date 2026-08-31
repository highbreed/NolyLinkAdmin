/**
 * `useInitializeDevice` calls the REAL `POST /v1/devices/initialize` (docs/api_reference.md).
 * Everything else here (`GET /admin/api/v1/branches*`) is mocked — no system-wide branch
 * list/detail read-model exists on the real backend yet (admin_portal_design.md §5.3).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { Branch, DeviceInitializeRequest, KraCallLogEntry, Page, SortParam, SyncStatusRow } from "@/api/types";

export interface BranchListParams {
  page: number;
  pageSize: number;
  sort: SortParam | null;
  search: string;
  status?: string;
}

export function useBranchesList(params: BranchListParams) {
  return useQuery({
    queryKey: ["branches", params],
    queryFn: () =>
      apiRequest<Page<Branch>>("/admin/api/v1/branches", {
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

export function useBranch(branchCode: string | undefined) {
  return useQuery({
    queryKey: ["branches", branchCode],
    queryFn: () => apiRequest<Branch>(`/admin/api/v1/branches/${branchCode}`),
    enabled: !!branchCode,
  });
}

export function useBranchCallLog(branchCode: string | undefined) {
  return useQuery({
    queryKey: ["branches", branchCode, "calls"],
    queryFn: () =>
      apiRequest<Page<KraCallLogEntry>>("/admin/api/v1/monitoring/kra-calls", {
        query: { branch_code: branchCode, page: 1, page_size: 20 },
      }),
    enabled: !!branchCode,
  });
}

export function useBranchSyncState(branchCode: string | undefined) {
  return useQuery({
    queryKey: ["branches", branchCode, "sync-state"],
    queryFn: () =>
      apiRequest<SyncStatusRow[]>("/admin/api/v1/monitoring/sync-status", {
        query: { branch_code: branchCode },
      }),
    enabled: !!branchCode,
  });
}

export function useInitializeDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DeviceInitializeRequest) =>
      apiRequest<Branch>("/v1/devices/initialize", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
  });
}
