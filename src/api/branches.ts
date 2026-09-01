/**
 * `useInitializeDevice` calls the REAL `POST /v1/devices/initialize`. `useBranchesList`/
 * `useBranch` call the REAL `GET /v1/admin/branches[/{code}]` read-model (confirmed against
 * the live backend, 2026-09-01) — a flat, unpaginated array, paginated/sorted/searched
 * client-side (src/lib/clientSidePaginate.ts), same as api/customers.ts.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { paginateClientSide } from "@/lib/clientSidePaginate";
import type { DataTableState } from "@/components/data-table/useDataTableState";
import type { AdminCallLogEntry, Branch, BranchAdmin, DeviceInitializeRequest, Page } from "@/api/types";

export function useAllBranches() {
  return useQuery({
    queryKey: ["branches"],
    queryFn: () => apiRequest<BranchAdmin[]>("/v1/admin/branches"),
  });
}

export function useBranchesList(
  tableState: Pick<DataTableState, "page" | "pageSize" | "sort" | "search"> & { status?: string },
): { data: Page<BranchAdmin> | undefined; isLoading: boolean; isError: boolean } {
  const query = useAllBranches();
  const items = query.data?.filter((b) => !tableState.status || b.status === tableState.status);
  const data = items
    ? paginateClientSide(items, tableState, {
        searchFields: (b) => [b.branch_code, b.tin],
        sortAccessor: (b, id) => (id === "branch_code" ? b.branch_code : id === "created_at" ? b.created_at : ""),
      })
    : undefined;
  return { data, isLoading: query.isLoading, isError: query.isError };
}

export function useBranch(branchCode: string | undefined) {
  return useQuery({
    queryKey: ["branches", branchCode],
    queryFn: () => apiRequest<BranchAdmin>(`/v1/admin/branches/${branchCode}`),
    enabled: !!branchCode,
  });
}

export function useBranchCallLog(branchCode: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ["call-logs", "branch", branchCode, limit],
    queryFn: () => apiRequest<AdminCallLogEntry[]>("/v1/admin/call-logs", { query: { branch_code: branchCode, limit } }),
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
