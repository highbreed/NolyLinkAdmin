/** Real — confirmed against the live backend 2026-11-09: GET /v1/admin/client-calls. */
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { ClientCallLogEntry, Page } from "@/api/types";

export interface ClientCallLogParams {
  page: number;
  pageSize: number;
  path?: string;
  clientId?: string;
  method?: string;
  statusCode?: number;
}

export function useClientCallLog(params: ClientCallLogParams) {
  return useQuery({
    queryKey: ["client-calls", params],
    queryFn: () =>
      apiRequest<Page<ClientCallLogEntry>>("/v1/admin/client-calls", {
        query: {
          page: params.page,
          page_size: params.pageSize,
          path: params.path || undefined,
          client_id: params.clientId || undefined,
          method: params.method || undefined,
          status_code: params.statusCode,
        },
      }),
  });
}
