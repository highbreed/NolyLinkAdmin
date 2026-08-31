/** Mocked-only — admin_portal_design.md §5.5, no real backend yet. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type {
  KraCallLogEntry,
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
    queryFn: () => apiRequest<MonitoringSummary>("/admin/api/v1/monitoring/summary"),
    refetchInterval: () => (document.visibilityState === "visible" ? 20_000 : false),
  });
}

export interface KraCallListParams {
  page: number;
  pageSize: number;
  sort: SortParam | null;
  search: string;
  resultCd?: string;
  branchCode?: string;
}

export function useKraCallsList(params: KraCallListParams) {
  return useQuery({
    queryKey: ["kra-calls", params],
    queryFn: () =>
      apiRequest<Page<KraCallLogEntry>>("/admin/api/v1/monitoring/kra-calls", {
        query: {
          page: params.page,
          page_size: params.pageSize,
          sort: params.sort ? `${params.sort.desc ? "-" : ""}${params.sort.id}` : undefined,
          q: params.search || undefined,
          result_cd: params.resultCd,
          branch_code: params.branchCode,
        },
      }),
  });
}

export function useKraCallsTimeseries(rangeHours: number) {
  return useQuery({
    queryKey: ["kra-calls-timeseries", rangeHours],
    queryFn: () =>
      apiRequest<KraCallTimeseriesPoint[]>("/admin/api/v1/monitoring/kra-calls/timeseries", {
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
      apiRequest<Page<OutboxItem>>("/admin/api/v1/monitoring/outbox", {
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
    queryFn: () => apiRequest<OutboxItem>(`/admin/api/v1/monitoring/outbox/${id}`),
    enabled: !!id,
  });
}

export function useRetryOutboxItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<OutboxItem>(`/admin/api/v1/monitoring/outbox/${id}/retry`, { method: "POST" }),
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
      apiRequest<OutboxItem>(`/admin/api/v1/monitoring/outbox/${id}/cancel`, { method: "POST" }),
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
    queryFn: () => apiRequest<SyncStatusRow[]>("/admin/api/v1/monitoring/sync-status"),
    refetchInterval: 30_000,
  });
}
