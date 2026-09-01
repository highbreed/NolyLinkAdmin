import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/data-table/DataTable";
import { useDataTableState } from "@/components/data-table/useDataTableState";
import { useBranchesList } from "@/api/branches";
import type { BranchAdmin } from "@/api/types";

const columns: ColumnDef<BranchAdmin, unknown>[] = [
  { id: "branch_code", header: "Branch code", accessorFn: (b) => b.branch_code },
  { id: "tin", header: "TIN", accessorFn: (b) => b.tin },
  { id: "bhf_id", header: "BHF ID", accessorFn: (b) => b.bhf_id },
  { id: "device_type", header: "Device type", accessorFn: (b) => b.device_type },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

export function BranchesListPage() {
  const navigate = useNavigate();
  const { state, setPage, setSort, setSearch, setFilter } = useDataTableState(["status"]);
  const query = useBranchesList({
    page: state.page,
    pageSize: state.pageSize,
    sort: state.sort,
    search: state.search,
    status: state.filters.status,
  });

  return (
    <div>
      <PageHeader
        title="Branches"
        description="Every KRA-registered device, system-wide."
        actions={
          <Button onClick={() => navigate("/branches/new")}>
            <Plus className="h-4 w-4" /> Initialize device
          </Button>
        }
      />
      <DataTable
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isError={query.isError}
        tableState={state}
        onSortChange={setSort}
        onSearchChange={setSearch}
        onPageChange={setPage}
        searchPlaceholder="Search by branch code or TIN…"
        onRowClick={(branch) => navigate(`/branches/${branch.branch_code}`)}
        emptyState="No branches initialized yet."
        toolbarExtra={
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={state.filters.status ?? ""}
            onChange={(e) => setFilter("status", e.target.value || undefined)}
            aria-label="Filter by branch status"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        }
      />
    </div>
  );
}
