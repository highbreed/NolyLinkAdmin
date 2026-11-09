import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { useDataTableState } from "@/components/data-table/useDataTableState";
import { useClientCallLog } from "@/api/clientCalls";
import { formatDateTime } from "@/lib/format";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { ColumnDef } from "@tanstack/react-table";
import type { ClientCallLogEntry } from "@/api/types";

/**
 * Every inbound client call and its response — "what did a client actually send us, and
 * what did we send back" (GET /v1/admin/client-calls), distinct from the KRA/VSCU call-log
 * views elsewhere, which show this gateway's own outbound calls. The search box filters by
 * path prefix (e.g. "/v1/sales-invoices") — there's no free-text body search server-side.
 */
export function ClientCallsPage() {
  const { state, setPage, setSort, setSearch } = useDataTableState([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const query = useClientCallLog({
    page: state.page,
    pageSize: state.pageSize,
    path: state.search,
  });

  const columns: ColumnDef<ClientCallLogEntry, unknown>[] = [
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
          {expandedId === row.original.id ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      ),
    },
    { id: "method", header: "Method", accessorFn: (e) => e.method, enableSorting: false },
    { id: "path", header: "Path", accessorFn: (e) => e.path, enableSorting: false },
    {
      id: "status_code",
      header: "Status",
      enableSorting: false,
      cell: ({ row }) => (
        <span className={statusClassName(row.original.status_code)}>
          {row.original.status_code}
        </span>
      ),
    },
    {
      id: "duration_ms",
      header: "Duration",
      enableSorting: false,
      accessorFn: (e) => `${e.duration_ms} ms`,
    },
    {
      id: "client_id",
      header: "Client",
      enableSorting: false,
      accessorFn: (e) => e.client_id ?? "—",
    },
    {
      id: "created_at",
      header: "When",
      enableSorting: false,
      cell: ({ row }) => formatDateTime(row.original.created_at),
    },
  ];

  const expandedRow = query.data?.items.find((e) => e.id === expandedId);

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
        searchPlaceholder="Filter by path prefix, e.g. /v1/sales-invoices…"
        onRowClick={(entry) => setExpandedId(expandedId === entry.id ? null : entry.id)}
        emptyState="No client calls recorded yet."
      />
      {expandedRow && (
        <Table>
          <TableBody>
            <TableRow>
              <TableCell colSpan={7}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Request</p>
                    <pre className="max-h-96 overflow-auto rounded bg-muted p-2 text-xs">
                      {formatBody(expandedRow.request_body)}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Response</p>
                    <pre className="max-h-96 overflow-auto rounded bg-muted p-2 text-xs">
                      {formatBody(expandedRow.response_body)}
                    </pre>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function formatBody(body: unknown): string {
  if (body === null || body === undefined) return "(empty body)";
  return JSON.stringify(body, null, 2);
}

function statusClassName(statusCode: number): string {
  if (statusCode >= 500) return "font-medium text-status-blocked";
  if (statusCode >= 400) return "font-medium text-status-grace";
  return "font-medium text-status-active";
}
