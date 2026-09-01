import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/data-table/DataTable";
import { useDataTableState } from "@/components/data-table/useDataTableState";
import { useBillingOverview, useAllInvoices } from "@/api/billing";
import { useAllCustomers } from "@/api/customers";
import { apiRequest } from "@/api/client";
import { bucketExpirations } from "@/lib/billingStatus";
import { formatDate, formatMoney } from "@/lib/format";
import type { ColumnDef } from "@tanstack/react-table";
import type { Invoice, Subscription } from "@/api/types";

const BUCKET_LABEL: Record<string, string> = {
  hard_blocked: "Blocked",
  in_grace: "In grace period",
  expiring_soon: "Expiring soon",
};

const invoiceColumns: ColumnDef<Invoice, unknown>[] = [
  { id: "id", header: "Invoice", accessorFn: (i) => i.id },
  { id: "customer_id", header: "Customer", accessorFn: (i) => i.customer_id },
  {
    id: "amount",
    header: "Amount",
    cell: ({ row }) => formatMoney(row.original.amount, row.original.currency),
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status === "PAID" ? "ACTIVE" : "GRACE"} />,
  },
  { id: "issued_at", header: "Issued", cell: ({ row }) => formatDate(row.original.issued_at) },
];

export function BillingOverviewPage() {
  const navigate = useNavigate();
  const overviewQuery = useBillingOverview();
  const { state, setPage, setSearch, setFilter, setSort } = useDataTableState(["status"]);
  const invoicesQuery = useAllInvoices({
    page: state.page,
    pageSize: state.pageSize,
    search: state.search,
    status: state.filters.status,
  });

  const customersQuery = useAllCustomers();
  const subscriptionQueries = useQueries({
    queries: (customersQuery.data ?? []).map((c) => ({
      queryKey: ["subscription", c.id],
      queryFn: () => apiRequest<Subscription>(`/v1/billing/subscriptions/${c.id}`).catch(() => null),
    })),
  });

  const expirations = useMemo(() => {
    if (!customersQuery.data) return [];
    return bucketExpirations(
      customersQuery.data.map((c, i) => ({
        customerId: c.id,
        subscription: (subscriptionQueries[i]?.data as Subscription | null | undefined) ?? null,
      })),
    );
  }, [customersQuery.data, subscriptionQueries]);

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Subscription status counts, expirations, and invoices." />

      <Card>
        <CardHeader>
          <CardTitle>Status counts</CardTitle>
        </CardHeader>
        <CardContent>
          {overviewQuery.data ? (
            <div className="flex flex-wrap gap-3">
              {(
                Object.entries(overviewQuery.data.counts) as [keyof typeof overviewQuery.data.counts, number][]
              ).map(([bucket, count]) => (
                <Link
                  key={bucket}
                  to={`/customers?status=${bucket}`}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-accent"
                >
                  <StatusBadge status={bucket} />
                  <span className="font-semibold">{count}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming expirations</CardTitle>
        </CardHeader>
        <CardContent>
          {expirations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing expiring, in grace, or blocked right now.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {expirations.map((e) => {
                const customer = customersQuery.data?.find((c) => c.id === e.customerId);
                return (
                  <li key={e.customerId} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <Link to={`/customers/${e.customerId}`} className="text-primary hover:underline">
                      {customer?.name ?? e.customerId}
                    </Link>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="rounded bg-muted px-2 py-0.5 text-xs">{BUCKET_LABEL[e.bucket]}</span>
                      {e.relevantDate ? formatDate(e.relevantDate.toISOString()) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={invoiceColumns}
            page={invoicesQuery.data}
            isLoading={invoicesQuery.isLoading}
            isError={invoicesQuery.isError}
            tableState={state}
            onSortChange={setSort}
            onSearchChange={setSearch}
            onPageChange={setPage}
            searchPlaceholder="Search invoices…"
            onRowClick={(invoice) => navigate(`/billing/invoices/${invoice.id}`)}
            emptyState="No invoices recorded yet."
            toolbarExtra={
              <select
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={state.filters.status ?? ""}
                onChange={(e) => setFilter("status", e.target.value || undefined)}
                aria-label="Filter by invoice status"
              >
                <option value="">All statuses</option>
                <option value="ISSUED">Issued</option>
                <option value="PAID">Paid</option>
              </select>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
