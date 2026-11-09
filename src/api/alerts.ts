/**
 * Real — confirmed against the live backend, 2026-11-09: GET/POST /v1/admin/alert-rules,
 * PATCH .../{id}, GET .../preview, GET /v1/admin/notifications. The preview's evaluated_as
 * field says which of the two ways it was computed — see AlertRulePreview's own doc-comment
 * (types.ts) and AlertRuleForm.tsx's caveat text built from it.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { AlertRule, AlertRuleInput, AlertRulePreview, NotificationSent, Page } from "@/api/types";

export function useAlertRules() {
  return useQuery({
    queryKey: ["alert-rules"],
    queryFn: () => apiRequest<AlertRule[]>("/v1/admin/alert-rules"),
  });
}

export function useCreateAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AlertRuleInput) =>
      apiRequest<AlertRule>("/v1/admin/alert-rules", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert-rules"] }),
  });
}

export function useUpdateAlertRule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<AlertRuleInput>) =>
      apiRequest<AlertRule>(`/v1/admin/alert-rules/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert-rules"] }),
  });
}

export function useAlertRulePreview(input: Pick<AlertRuleInput, "metric" | "condition" | "threshold" | "scope_customer_id" | "scope_branch_code"> | null) {
  return useQuery({
    queryKey: ["alert-rule-preview", input],
    queryFn: () =>
      apiRequest<AlertRulePreview>("/v1/admin/alert-rules/preview", {
        query: {
          metric: input?.metric,
          condition: input?.condition,
          threshold: input?.threshold,
          scope_customer_id: input?.scope_customer_id ?? undefined,
          scope_branch_code: input?.scope_branch_code ?? undefined,
        },
      }),
    enabled: !!input,
  });
}

export function useNotificationsList() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiRequest<Page<NotificationSent>>("/v1/admin/notifications", { query: { page: 1, page_size: 50 } }),
  });
}
