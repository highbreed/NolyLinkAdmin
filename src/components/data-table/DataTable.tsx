import { useEffect, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DataTableState } from "@/components/data-table/useDataTableState";
import type { Page } from "@/api/types";

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  page: Page<T> | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  tableState: DataTableState;
  onSortChange: (sort: { id: string; desc: boolean } | null) => void;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  searchPlaceholder?: string;
  toolbarExtra?: ReactNode;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  page,
  isLoading,
  isError,
  errorMessage,
  tableState,
  onSortChange,
  onSearchChange,
  onPageChange,
  searchPlaceholder = "Search…",
  toolbarExtra,
  emptyState,
  onRowClick,
}: DataTableProps<T>) {
  const [searchDraft, setSearchDraft] = useState(tableState.search);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchDraft !== tableState.search) onSearchChange(searchDraft);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const table = useReactTable({
    data: page?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  const totalPages = page ? Math.max(1, Math.ceil(page.total / page.page_size)) : 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={searchPlaceholder}
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            aria-label="Search"
          />
        </div>
        {toolbarExtra}
      </div>

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const columnId = header.column.id;
                const sortable = header.column.columnDef.enableSorting !== false;
                const isSorted = tableState.sort?.id === columnId;
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() =>
                          onSortChange(
                            isSorted && !tableState.sort?.desc
                              ? { id: columnId, desc: true }
                              : isSorted && tableState.sort?.desc
                                ? null
                                : { id: columnId, desc: false },
                          )
                        }
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {isSorted ? (
                          tableState.sort?.desc ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUp className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-8 text-center text-destructive">
                {errorMessage ?? "Failed to load data."}
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                {emptyState ?? "No results."}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={onRowClick ? "cursor-pointer" : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{page ? `${page.total} total` : ""}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={tableState.page <= 1}
            onClick={() => onPageChange(tableState.page - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span>
            Page {tableState.page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={tableState.page >= totalPages}
            onClick={() => onPageChange(tableState.page + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
