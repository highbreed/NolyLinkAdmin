/**
 * Real — confirmed against the live backend, 2026-11-09: GET /v1/admin/audit-log. No sort
 * support server-side (same as every other list endpoint in this admin surface — newest-
 * first only); `since`/`until` are real and a genuine improvement over the original mocked
 * contract, which never had a date-range filter.
 */
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { AuditLogEntry, Page, SortParam } from "@/api/types";

export interface AuditLogParams {
  page: number;
  pageSize: number;
  sort: SortParam | null;
  search: string;
  targetType?: string;
  targetId?: string;
  since?: string;
  until?: string;
}

export function useAuditLog(params: AuditLogParams) {
  return useQuery({
    queryKey: ["audit-log", params],
    queryFn: () =>
      apiRequest<Page<AuditLogEntry>>("/v1/admin/audit-log", {
        query: {
          page: params.page,
          page_size: params.pageSize,
          q: params.search || undefined,
          target_type: params.targetType,
          target_id: params.targetId,
          since: params.since,
          until: params.until,
        },
      }),
  });
}
