import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { useDataTableState } from "@/components/data-table/useDataTableState";
import { useAuditLog } from "@/api/auditLog";
import { AuditDiffView } from "@/features/audit-log/AuditDiffView";
import { formatDateTime } from "@/lib/format";
import type { ColumnDef } from "@tanstack/react-table";
import type { AuditLogEntry } from "@/api/types";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

/**
 * Shared between the global /audit-log page and the per-client Audit tab (scoped via
 * `targetId`) — one implementation, not duplicated.
 */
export function AuditLogTable({ targetType, targetId }: { targetType?: string; targetId?: string }) {
  const { state, setPage, setSort, setSearch } = useDataTableState([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const query = useAuditLog({
    page: state.page,
    pageSize: state.pageSize,
    sort: state.sort,
    search: state.search,
    targetType,
    targetId,
  });

  const columns: ColumnDef<AuditLogEntry, unknown>[] = [
    {
      id: "expand",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <button
          type="button"
          aria-label={expandedId === row.original.id ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation();
            setExpandedId(expandedId === row.original.id ? null : row.original.id);
          }}
        >
          {expandedId === row.original.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      ),
    },
    {
      id: "admin_user_email",
      header: "Admin",
      accessorFn: (e) => e.admin_user_email ?? "break-glass key",
    },
    { id: "action", header: "Action", accessorFn: (e) => e.action },
    { id: "target_type", header: "Target", cell: ({ row }) => `${row.original.target_type} / ${row.original.target_id}` },
    { id: "reason", header: "Reason", accessorFn: (e) => e.reason ?? "—" },
    {
      id: "created_at",
      header: "When",
      cell: ({ row }) => formatDateTime(row.original.created_at),
    },
  ];

  return (
    <div className="space-y-2">
      <DataTable
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isError={query.isError}
        tableState={state}
        onSortChange={setSort}
        onSearchChange={setSearch}
        onPageChange={setPage}
        searchPlaceholder="Search by action or admin…"
        onRowClick={(entry) => setExpandedId(expandedId === entry.id ? null : entry.id)}
        emptyState="No admin actions recorded yet."
      />
      {expandedId !== null && query.data && (
        <Table>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6}>
                <AuditDiffView
                  before={query.data.items.find((e) => e.id === expandedId)?.before_state ?? null}
                  after={query.data.items.find((e) => e.id === expandedId)?.after_state ?? null}
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}
