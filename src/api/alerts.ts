/** Mocked-only — admin_portal_design.md §5.6, no real backend yet. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { AlertRule, AlertRuleInput, NotificationSent, Page } from "@/api/types";

export function useAlertRules() {
  return useQuery({
    queryKey: ["alert-rules"],
    queryFn: () => apiRequest<AlertRule[]>("/admin/api/v1/alert-rules"),
  });
}

export function useCreateAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AlertRuleInput) =>
      apiRequest<AlertRule>("/admin/api/v1/alert-rules", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert-rules"] }),
  });
}

export function useUpdateAlertRule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<AlertRuleInput>) =>
      apiRequest<AlertRule>(`/admin/api/v1/alert-rules/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert-rules"] }),
  });
}

export function useAlertRulePreview(input: Pick<AlertRuleInput, "metric" | "condition" | "threshold" | "scope_client_id" | "scope_branch_code"> | null) {
  return useQuery({
    queryKey: ["alert-rule-preview", input],
    queryFn: () =>
      apiRequest<{ fired_count_last_7_days: number }>("/admin/api/v1/alert-rules/preview", {
        query: {
          metric: input?.metric,
          condition: input?.condition,
          threshold: input?.threshold,
          scope_client_id: input?.scope_client_id ?? undefined,
          scope_branch_code: input?.scope_branch_code ?? undefined,
        },
      }),
    enabled: !!input,
  });
}

export function useNotificationsList() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiRequest<Page<NotificationSent>>("/admin/api/v1/notifications", { query: { page: 1, page_size: 50 } }),
  });
}
