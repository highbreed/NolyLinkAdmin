/**
 * `useAdminCallLogs` calls the REAL `GET /v1/admin/call-logs` (confirmed against the live
 * backend, 2026-09-01) — merged OSCU/VSCU log viewer, `limit`-capped (most recent N, newest
 * first), no true server-side pagination (see the endpoint's own docstring). Everything else
 * here (summary tiles, the timeseries chart, outbox, sync-status) is now ALSO real —
 * confirmed against the live backend, 2026-11-09, GET /v1/admin/monitoring/*. The outbox
 * list supports free-text search (q) but not sort — newest-first only, same as every other
 * list endpoint in this admin surface; sort is a client-side no-op until the backend grows
 * real sort support everywhere, not just here.
 */
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type {
  AdminCallLogEntry,
  KraCallTimeseriesPoint,
  MonitoringSummary,
  OutboxItem,
  Page,
  SortParam,
  SyncStatusRow,
} from "@/api/types";

export function useMonitoringSummary() {
  return useQuery({
    queryKey: ["monitoring-summary"],
    queryFn: () => apiRequest<MonitoringSummary>("/v1/admin/monitoring/summary"),
    refetchInterval: () => (document.visibilityState === "visible" ? 20_000 : false),
  });
}

export interface AdminCallLogParams {
  branchCode?: string;
  protocol?: "OSCU" | "VSCU";
  resultCd?: string;
  limit?: number;
}

export function useAdminCallLogs(params: AdminCallLogParams) {
  return useQuery({
    queryKey: ["call-logs", params],
    queryFn: () =>
      apiRequest<AdminCallLogEntry[]>("/v1/admin/call-logs", {
        query: {
          branch_code: params.branchCode,
          protocol: params.protocol,
          result_cd: params.resultCd,
          limit: params.limit ?? 50,
        },
      }),
  });
}

/**
 * The real call-logs endpoint only filters by a single `branch_code`, not a customer — this
 * fans out one request per branch a customer owns and merges the results, for the customer
 * detail page's Activity tab. Fine for the small branch counts an admin tool deals with; would
 * need a real customer-scoped endpoint to stay reasonable at real scale.
 */
export function useCustomerActivity(branchCodes: string[], limitPerBranch = 10) {
  const queries = useQueries({
    queries: branchCodes.map((branchCode) => ({
      queryKey: ["call-logs", "branch", branchCode, limitPerBranch],
      queryFn: () =>
        apiRequest<AdminCallLogEntry[]>("/v1/admin/call-logs", {
          query: { branch_code: branchCode, limit: limitPerBranch },
        }),
    })),
  });
  const isLoading = queries.some((q) => q.isLoading);
  const entries = queries
    .flatMap((q) => q.data ?? [])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return { entries, isLoading };
}

export function useKraCallsTimeseries(rangeHours: number) {
  return useQuery({
    queryKey: ["kra-calls-timeseries", rangeHours],
    queryFn: () =>
      apiRequest<KraCallTimeseriesPoint[]>("/v1/admin/monitoring/kra-calls/timeseries", {
        query: { range_hours: rangeHours },
      }),
  });
}

export interface OutboxListParams {
  page: number;
  pageSize: number;
  sort: SortParam | null;
  search: string;
  status?: string;
}

export function useOutboxList(params: OutboxListParams) {
  return useQuery({
    queryKey: ["outbox", params],
    queryFn: () =>
      apiRequest<Page<OutboxItem>>("/v1/admin/monitoring/outbox", {
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

export function useOutboxItem(id: string | undefined) {
  return useQuery({
    queryKey: ["outbox", id],
    queryFn: () => apiRequest<OutboxItem>(`/v1/admin/monitoring/outbox/${id}`),
    enabled: !!id,
  });
}

export function useRetryOutboxItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<OutboxItem>(`/v1/admin/monitoring/outbox/${id}/retry`, { method: "POST" }),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["outbox"] });
      const previous = qc.getQueriesData<Page<OutboxItem>>({ queryKey: ["outbox"] });
      qc.setQueriesData<Page<OutboxItem>>({ queryKey: ["outbox"] }, (old) =>
        old
          ? { ...old, items: old.items.map((i) => (i.id === id ? { ...i, status: "PENDING" } : i)) }
          : old,
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["outbox"] }),
  });
}

export function useCancelOutboxItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<OutboxItem>(`/v1/admin/monitoring/outbox/${id}/cancel`, { method: "POST" }),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["outbox"] });
      const previous = qc.getQueriesData<Page<OutboxItem>>({ queryKey: ["outbox"] });
      qc.setQueriesData<Page<OutboxItem>>({ queryKey: ["outbox"] }, (old) =>
        old
          ? { ...old, items: old.items.map((i) => (i.id === id ? { ...i, status: "CANCELLED" } : i)) }
          : old,
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["outbox"] }),
  });
}

export function useSyncStatusList() {
  return useQuery({
    queryKey: ["sync-status"],
    queryFn: () => apiRequest<SyncStatusRow[]>("/v1/admin/monitoring/sync-status"),
    refetchInterval: 30_000,
  });
}
