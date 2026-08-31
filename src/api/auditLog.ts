/** Mocked-only — admin_portal_design.md §5.7/§7 (admin_audit_log), no real backend yet. */
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
}

export function useAuditLog(params: AuditLogParams) {
  return useQuery({
    queryKey: ["audit-log", params],
    queryFn: () =>
      apiRequest<Page<AuditLogEntry>>("/admin/api/v1/audit-log", {
        query: {
          page: params.page,
          page_size: params.pageSize,
          sort: params.sort ? `${params.sort.desc ? "-" : ""}${params.sort.id}` : undefined,
          q: params.search || undefined,
          target_type: params.targetType,
          target_id: params.targetId,
        },
      }),
  });
}
