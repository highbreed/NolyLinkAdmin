/**
 * Real endpoints (confirmed against the live backend, 2026-09-01): `POST/GET/PATCH
 * /v1/customers`, `POST /v1/customers/onboard`, `POST/GET /v1/customers/{id}/connectors`. See
 * docs/frontend_README.md.
 *
 * GET /v1/customers returns a flat, unpaginated array — pagination/sort/search here are
 * applied client-side over the cached full list (src/lib/clientSidePaginate.ts), not sent as
 * query params the backend would ignore.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type {
  Connector,
  ConnectorSecretOnce,
  CreateCustomerRequest,
  Customer,
  CustomerOnboardRequest,
  CustomerOnboardResponse,
  UpdateCustomerRequest,
} from "@/api/types";

export function useAllCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: () => apiRequest<Customer[]>("/v1/customers"),
  });
}

export function useCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: ["customers", customerId],
    queryFn: () => apiRequest<Customer>(`/v1/customers/${customerId}`),
    enabled: !!customerId,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCustomerRequest) => apiRequest<Customer>("/v1/customers", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

/**
 * The stepper-form onboarding call: registers every branch (KRA + VSCU device init) and
 * creates the Customer with whichever branches succeeded, in one request. Always resolves —
 * per-branch REGISTERED/FAILED status lives in the response, not in HTTP success/failure.
 */
export function useOnboardCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CustomerOnboardRequest) =>
      apiRequest<CustomerOnboardResponse>("/v1/customers/onboard", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["branches"] });
    },
  });
}

export function useUpdateCustomer(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCustomerRequest) =>
      apiRequest<Customer>(`/v1/customers/${customerId}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers", customerId] });
    },
  });
}

/** Convenience wrapper around useUpdateCustomer for the common "attach one more branch" action. */
export function useAttachBranch(customerId: string, currentBranchCodes: string[]) {
  const update = useUpdateCustomer(customerId);
  return {
    ...update,
    mutate: (branchCode: string, options?: Parameters<typeof update.mutate>[1]) =>
      update.mutate(
        { branch_codes: currentBranchCodes.includes(branchCode) ? currentBranchCodes : [...currentBranchCodes, branchCode] },
        options,
      ),
  };
}

export function useConnectors(customerId: string | undefined) {
  return useQuery({
    queryKey: ["connectors", customerId],
    queryFn: () => apiRequest<Connector[]>(`/v1/customers/${customerId}/connectors`),
    enabled: !!customerId,
  });
}

export function useCreateConnector(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiRequest<ConnectorSecretOnce>(`/v1/customers/${customerId}/connectors`, {
        method: "POST",
        body: { name },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connectors", customerId] }),
  });
}
