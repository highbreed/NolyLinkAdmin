/**
 * Real backend endpoints (docs/api_reference.md "Admin — Billing") — these call the actual
 * `/v1/billing/*` routes under `X-Admin-Api-Key`, unlike most of src/api/*.ts. Only
 * `useBillingOverview` below is mocked (no system-wide aggregate endpoint exists yet; see
 * admin_portal_design.md §5.4's proposed `/admin/api/v1/billing/overview`).
 *
 * Suspend/reactivate/cancel are each defined ONCE here and reused by both the client detail
 * billing tab and the billing overview page — no duplicated mutation logic anywhere else.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { BillingOverview, Invoice, Page, Subscription } from "@/api/types";

export function useSubscription(clientId: string | undefined) {
  return useQuery({
    queryKey: ["subscription", clientId],
    queryFn: () => apiRequest<Subscription>(`/v1/billing/subscriptions/${clientId}`),
    enabled: !!clientId,
    retry: (failureCount, error) => {
      // 404 = genuinely no subscription on file yet — not worth retrying.
      if ((error as { status?: number })?.status === 404) return false;
      return failureCount < 2;
    },
  });
}

export function useUpsertSubscription(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { plan_name: string; current_period_end: string; grace_period_days?: number | null }) =>
      apiRequest<Subscription>(`/v1/billing/subscriptions/${clientId}`, { method: "PUT", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscription", clientId] }),
  });
}

export function useSuspendSubscription(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      apiRequest<Subscription>(`/v1/billing/subscriptions/${clientId}/suspend`, {
        method: "POST",
        body: { reason },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription", clientId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useReactivateSubscription(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<Subscription>(`/v1/billing/subscriptions/${clientId}/reactivate`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription", clientId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useCancelSubscription(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<Subscription>(`/v1/billing/subscriptions/${clientId}/cancel`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription", clientId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useClientInvoices(clientId: string | undefined) {
  return useQuery({
    queryKey: ["invoices", clientId],
    queryFn: () => apiRequest<Invoice[]>(`/v1/billing/clients/${clientId}/invoices`),
    enabled: !!clientId,
  });
}

export function useCreateInvoice(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { period_start: string; period_end: string; amount: string; currency?: string; notes?: string }) =>
      apiRequest<Invoice>(`/v1/billing/clients/${clientId}/invoices`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices", clientId] }),
  });
}

export function useInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["invoice-detail", invoiceId],
    queryFn: () => apiRequest<Invoice>(`/admin/api/v1/billing/invoices/${invoiceId}`),
    enabled: !!invoiceId,
  });
}

export function useMarkInvoicePaid(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (extendSubscriptionTo: string | null) =>
      apiRequest<Invoice>(`/v1/billing/invoices/${invoiceId}/mark-paid`, {
        method: "POST",
        body: { extend_subscription_to: extendSubscriptionTo },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["all-invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      qc.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}

export function useBillingOverview() {
  return useQuery({
    queryKey: ["billing-overview"],
    queryFn: () => apiRequest<BillingOverview>("/admin/api/v1/billing/overview"),
    refetchInterval: 30_000,
  });
}

export interface InvoiceListParams {
  page: number;
  pageSize: number;
  search: string;
  status?: string;
}

export function useAllInvoices(params: InvoiceListParams) {
  return useQuery({
    queryKey: ["all-invoices", params],
    queryFn: () =>
      apiRequest<Page<Invoice>>("/admin/api/v1/billing/invoices", {
        query: { page: params.page, page_size: params.pageSize, q: params.search || undefined, status: params.status },
      }),
  });
}
