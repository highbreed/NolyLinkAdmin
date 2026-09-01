import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/data-table/DataTable";
import { useDataTableState } from "@/components/data-table/useDataTableState";
import {
  useCancelOutboxItem,
  useKraCallsTimeseries,
  useOutboxList,
  useRetryOutboxItem,
  useSyncStatusList,
} from "@/api/monitoring";
import { transformTimeseriesForChart } from "@/lib/monitoringTransform";
import { formatRelativeToNow } from "@/lib/format";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/use-toast";
import type { OutboxItem } from "@/api/types";

const RESULT_CD_COLORS: Record<string, string> = {
  "000": "hsl(var(--status-active))",
  "990": "hsl(var(--status-grace))",
  "999": "hsl(var(--status-blocked))",
};

const RANGE_OPTIONS = [
  { label: "Last 6h", hours: 6 },
  { label: "Last 24h", hours: 24 },
  { label: "Last 7d", hours: 168 },
];

function KraCallsChart() {
  const [rangeHours, setRangeHours] = useState(24);
  const timeseriesQuery = useKraCallsTimeseries(rangeHours);
  const { rows, resultCodes } = useMemo(
    () => transformTimeseriesForChart(timeseriesQuery.data ?? []),
    [timeseriesQuery.data],
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>KRA calls by result code</CardTitle>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <Button
              key={opt.hours}
              size="sm"
              variant={rangeHours === opt.hours ? "default" : "outline"}
              onClick={() => setRangeHours(opt.hours)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="time" tickFormatter={(v) => new Date(v).toLocaleTimeString()} fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} />
              <Legend />
              {resultCodes.map((code) => (
                <Area
                  key={code}
                  type="monotone"
                  dataKey={code}
                  stackId="1"
                  stroke={RESULT_CD_COLORS[code] ?? "hsl(var(--muted-foreground))"}
                  fill={RESULT_CD_COLORS[code] ?? "hsl(var(--muted-foreground))"}
                  fillOpacity={0.5}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function OutboxTable() {
  const navigate = useNavigate();
  const { state, setPage, setSort, setSearch, setFilter } = useDataTableState(["status"]);
  const query = useOutboxList({
    page: state.page,
    pageSize: state.pageSize,
    sort: state.sort,
    search: state.search,
    status: state.filters.status,
  });
  const retry = useRetryOutboxItem();
  const cancel = useCancelOutboxItem();
  const [cancelTarget, setCancelTarget] = useState<OutboxItem | null>(null);

  const columns: ColumnDef<OutboxItem, unknown>[] = [
    { id: "endpoint", header: "Endpoint", accessorFn: (o) => o.endpoint },
    { id: "branch_code", header: "Branch", accessorFn: (o) => o.branch_code ?? "—" },
    { id: "customer_name", header: "Customer", accessorFn: (o) => o.customer_name ?? "—" },
    { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: "attempts", header: "Attempts", accessorFn: (o) => o.attempts },
    { id: "last_error", header: "Last error", accessorFn: (o) => o.last_error ?? "—" },
    { id: "updated_at", header: "Age", cell: ({ row }) => formatRelativeToNow(row.original.updated_at) },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex gap-1">
            {(item.status === "FAILED" || item.status === "RETRYING") && (
              <Button
                size="sm"
                variant="outline"
                disabled={retry.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  retry.mutate(item.id);
                }}
              >
                Retry
              </Button>
            )}
            {item.status !== "CANCELLED" && item.status !== "SENT" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setCancelTarget(item);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outbox</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          page={query.data}
          isLoading={query.isLoading}
          isError={query.isError}
          tableState={state}
          onSortChange={setSort}
          onSearchChange={setSearch}
          onPageChange={setPage}
          searchPlaceholder="Search by endpoint, branch, customer…"
          onRowClick={(item) => navigate(`/monitoring/outbox/${item.id}`)}
          emptyState="Outbox is empty."
          toolbarExtra={
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={state.filters.status ?? ""}
              onChange={(e) => setFilter("status", e.target.value || undefined)}
              aria-label="Filter by outbox status"
            >
              <option value="">All statuses</option>
              {["PENDING", "RETRYING", "FAILED", "SENT", "CANCELLED"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          }
        />
      </CardContent>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel this outbox item?"
        description="Stops the dispatcher from retrying it permanently — use only for known-bad data the connector needs to resubmit."
        confirmLabel="Cancel item"
        variant="destructive"
        isPending={cancel.isPending}
        onConfirm={() =>
          cancelTarget &&
          cancel.mutate(cancelTarget.id, {
            onSuccess: () => {
              toast({ title: "Outbox item cancelled." });
              setCancelTarget(null);
            },
          })
        }
      />
    </Card>
  );
}

function SyncStatusTable() {
  const syncQuery = useSyncStatusList();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync status (worst offenders first)</CardTitle>
      </CardHeader>
      <CardContent>
        {syncQuery.data?.length ? (
          <ul className="space-y-2 text-sm">
            {syncQuery.data.map((row) => (
              <li
                key={`${row.branch_code}-${row.resource}`}
                className="flex items-center justify-between border-b pb-2 last:border-0"
              >
                <span>
                  {row.branch_code} / {row.resource}
                </span>
                <span className={row.lag_seconds > 1800 ? "font-medium text-status-blocked" : "text-muted-foreground"}>
                  {formatRelativeToNow(row.last_req_dt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No sync state recorded.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function MonitoringPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Monitoring" description="KRA call health, outbox backlog, and sync lag." />
      <KraCallsChart />
      <OutboxTable />
      <SyncStatusTable />
    </div>
  );
}
