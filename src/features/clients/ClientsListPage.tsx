import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/data-table/DataTable";
import { useDataTableState } from "@/components/data-table/useDataTableState";
import { useClientsList } from "@/api/clients";
import { deriveBillingStatus } from "@/lib/billingStatus";
import { formatDate, formatRelativeToNow } from "@/lib/format";
import type { Client } from "@/api/types";

const STATUS_OPTIONS = ["ACTIVE", "GRACE", "BLOCKED", "SUSPENDED", "CANCELLED", "NO_SUBSCRIPTION"];

const columns: ColumnDef<Client, unknown>[] = [
  { id: "name", header: "Name", accessorFn: (c) => c.name },
  {
    id: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge status={deriveBillingStatus(row.original.subscription).bucket} />,
  },
  { id: "branch_count", header: "Branches", accessorFn: (c) => c.branch_count },
  { id: "plan_name", header: "Plan", accessorFn: (c) => c.subscription?.plan_name ?? "—" },
  {
    id: "paid_through",
    header: "Paid through",
    accessorFn: (c) => c.subscription?.current_period_end,
    cell: ({ getValue }) => formatDate(getValue<string | undefined>()),
  },
  {
    id: "last_kra_call_at",
    header: "Last KRA call",
    cell: ({ row }) => formatRelativeToNow(row.original.last_kra_call_at),
  },
  {
    id: "failing_calls_24h",
    header: "Failing (24h)",
    accessorFn: (c) => c.failing_calls_24h,
    cell: ({ getValue }) => {
      const value = getValue<number>();
      return value > 0 ? <span className="font-medium text-status-blocked">{value}</span> : value;
    },
  },
];

export function ClientsListPage() {
  const navigate = useNavigate();
  const { state, setPage, setSort, setSearch, setFilter } = useDataTableState(["status"]);
  const query = useClientsList({
    page: state.page,
    pageSize: state.pageSize,
    sort: state.sort,
    search: state.search,
    status: state.filters.status,
  });

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Every integration client and their current billing status."
        actions={
          <Button onClick={() => navigate("/clients/new")}>
            <Plus className="h-4 w-4" /> Register client
          </Button>
        }
      />

      <DataTable
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={query.error instanceof Error ? query.error.message : undefined}
        tableState={state}
        onSortChange={setSort}
        onSearchChange={setSearch}
        onPageChange={setPage}
        searchPlaceholder="Search clients by name…"
        onRowClick={(client) => navigate(`/clients/${client.id}`)}
        emptyState={
          <div className="space-y-1">
            <p>No clients registered yet.</p>
            <Button variant="link" onClick={() => navigate("/clients/new")}>
              Register your first client
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
