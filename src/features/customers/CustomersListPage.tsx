import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/data-table/DataTable";
import { useDataTableState } from "@/components/data-table/useDataTableState";
import { useAllCustomers } from "@/api/customers";
import { apiRequest } from "@/api/client";
import { paginateClientSide } from "@/lib/clientSidePaginate";
import { deriveBillingStatus, type BillingStatusBucket } from "@/lib/billingStatus";
import { formatDate } from "@/lib/format";
import type { Customer, Subscription } from "@/api/types";

const STATUS_OPTIONS = ["ACTIVE", "GRACE", "BLOCKED", "SUSPENDED", "CANCELLED", "NO_SUBSCRIPTION"];

interface CustomerRow extends Customer {
  subscription: Subscription | null;
  status: BillingStatusBucket;
}

const columns: ColumnDef<CustomerRow, unknown>[] = [
  { id: "name", header: "Name", accessorFn: (c) => c.name },
  { id: "status", header: "Status", enableSorting: false, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { id: "branch_count", header: "Branches", accessorFn: (c) => c.branch_codes.length },
  { id: "plan_name", header: "Plan", accessorFn: (c) => c.subscription?.plan_name ?? "—" },
  {
    id: "paid_through",
    header: "Paid through",
    cell: ({ row }) => formatDate(row.original.subscription?.current_period_end),
  },
  { id: "created_at", header: "Onboarded", cell: ({ row }) => formatDate(row.original.created_at) },
];

/**
 * The real GET /v1/customers response has no billing fields (billing is a separate
 * Subscription resource) — this fetches every customer's subscription in parallel
 * (react-query dedupes/caches each by id, so navigating into a customer detail page reuses
 * the same cached fetch) so status filtering/sorting/the dashboard's click-through-to-filtered
 * behavior all work against real data, not just the base customer list.
 */
export function CustomersListPage() {
  const navigate = useNavigate();
  const { state, setPage, setSort, setSearch, setFilter } = useDataTableState(["status"]);

  const customersQuery = useAllCustomers();
  const subscriptionQueries = useQueries({
    queries: (customersQuery.data ?? []).map((c) => ({
      queryKey: ["subscription", c.id],
      queryFn: () => apiRequest<Subscription>(`/v1/billing/subscriptions/${c.id}`).catch(() => null),
      enabled: !!customersQuery.data,
    })),
  });

  const rows = useMemo<CustomerRow[]>(() => {
    if (!customersQuery.data) return [];
    return customersQuery.data.map((customer, i) => {
      const subscription = (subscriptionQueries[i]?.data as Subscription | null | undefined) ?? null;
      return { ...customer, subscription, status: deriveBillingStatus(subscription).bucket };
    });
  }, [customersQuery.data, subscriptionQueries]);

  const subscriptionsLoading = subscriptionQueries.some((q) => q.isLoading);
  const filteredRows = state.filters.status ? rows.filter((r) => r.status === state.filters.status) : rows;

  const page = paginateClientSide(filteredRows, state, {
    searchFields: (c) => [c.name, c.id],
    sortAccessor: (c, id) =>
      id === "name" ? c.name : id === "branch_count" ? c.branch_codes.length : id === "created_at" ? c.created_at : "",
  });

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Every paying business and their current billing status."
        actions={
          <Button onClick={() => navigate("/customers/new")}>
            <Plus className="h-4 w-4" /> Register customer
          </Button>
        }
      />

      <DataTable
        columns={columns}
        page={page}
        isLoading={customersQuery.isLoading || subscriptionsLoading}
        isError={customersQuery.isError}
        errorMessage={customersQuery.error instanceof Error ? customersQuery.error.message : undefined}
        tableState={state}
        onSortChange={setSort}
        onSearchChange={setSearch}
        onPageChange={setPage}
        searchPlaceholder="Search customers by name…"
        onRowClick={(customer) => navigate(`/customers/${customer.id}`)}
        emptyState={
          <div className="space-y-1">
            <p>No customers registered yet.</p>
            <Button variant="link" onClick={() => navigate("/customers/new")}>
              Register your first customer
            </Button>
          </div>
        }
        toolbarExtra={
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={state.filters.status ?? ""}
            onChange={(e) => setFilter("status", e.target.value || undefined)}
            aria-label="Filter by billing status"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        }
      />
    </div>
  );
}
