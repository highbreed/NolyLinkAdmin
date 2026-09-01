/**
 * Real backend endpoints (docs/api_reference.md "Admin — Billing") — these call the actual
 * `/v1/billing/*` routes under `X-Admin-Api-Key`/admin JWT, unlike most of src/api/*.ts.
 * Keyed by `customer_id`, not `client_id`, since the 2026-09-01 Customer/Client(connector)
 * split moved billing onto the paying business (Customer), not any one of its connectors.
 *
 * `useInvoice`, `useBillingOverview`, and `useAllInvoices` are mocked-only: the real backend
 * has no single-invoice lookup or global cross-customer invoice list, only
 * `GET /v1/billing/customers/{id}/invoices` (per-customer, wrapped by `useCustomerInvoices`).
 *
 * Suspend/reactivate/cancel are each defined ONCE here and reused by both the customer detail
 * billing tab and the billing overview page — no duplicated mutation logic anywhere else.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { BillingOverview, Invoice, Page, Subscription } from "@/api/types";

export function useSubscription(customerId: string | undefined) {
  return useQuery({
    queryKey: ["subscription", customerId],
    queryFn: () => apiRequest<Subscription>(`/v1/billing/subscriptions/${customerId}`),
    enabled: !!customerId,
    retry: (failureCount, error) => {
      // 404 = genuinely no subscription on file yet — not worth retrying.
      if ((error as { status?: number })?.status === 404) return false;
      return failureCount < 2;
    },
  });
}

export function useUpsertSubscription(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { plan_name: string; current_period_end: string; grace_period_days?: number | null }) =>
      apiRequest<Subscription>(`/v1/billing/subscriptions/${customerId}`, { method: "PUT", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscription", customerId] }),
  });
}

export function useSuspendSubscription(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      apiRequest<Subscription>(`/v1/billing/subscriptions/${customerId}/suspend`, {
        method: "POST",
        body: { reason },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription", customerId] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useReactivateSubscription(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<Subscription>(`/v1/billing/subscriptions/${customerId}/reactivate`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription", customerId] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useCancelSubscription(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<Subscription>(`/v1/billing/subscriptions/${customerId}/cancel`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription", customerId] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useCustomerInvoices(customerId: string | undefined) {
  return useQuery({
    queryKey: ["invoices", customerId],
    queryFn: () => apiRequest<Invoice[]>(`/v1/billing/customers/${customerId}/invoices`),
    enabled: !!customerId,
  });
}

export function useCreateInvoice(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { period_start: string; period_end: string; amount: string; currency?: string; notes?: string }) =>
      apiRequest<Invoice>(`/v1/billing/customers/${customerId}/invoices`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices", customerId] }),
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
