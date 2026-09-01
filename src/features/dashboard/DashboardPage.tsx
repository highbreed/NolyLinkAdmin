import { Link } from "react-router-dom";
import { AlertTriangle, Inbox, Server, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useMonitoringSummary } from "@/api/monitoring";
import { useBillingOverview } from "@/api/billing";
import { useNotificationsList } from "@/api/alerts";
import { formatPercent, formatRelativeToNow } from "@/lib/format";

export function DashboardPage() {
  const summaryQuery = useMonitoringSummary();
  const billingQuery = useBillingOverview();
  const notificationsQuery = useNotificationsList();

  const summary = summaryQuery.data;
  const billing = billingQuery.data;

  return (
    <div>
      <PageHeader title="Dashboard" description="System health, billing, and monitoring at a glance." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4" /> System health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-1">
                <p className="text-2xl font-semibold">
                  {summary ? formatPercent(summary.kra_call_success_rate_1h) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">KRA call success rate, last hour</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Success rate (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {summary ? formatPercent(summary.kra_call_success_rate_24h) : "—"}
            </p>
            <Link to="/monitoring" className="text-xs text-primary hover:underline">
              View breakdown by result code →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Worst sync offender
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary?.worst_sync_offender ? (
              <>
                <p className="text-sm font-medium">
                  {summary.worst_sync_offender.resource} — {summary.worst_sync_offender.branch_code}
                </p>
                <p className="text-xs text-muted-foreground">
                  hasn't synced {formatRelativeToNow(summary.worst_sync_offender.last_req_dt)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">All branches in sync.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-4 w-4" /> Outbox backlog
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Link to="/monitoring?status=FAILED" className="hover:underline">
                <span className="text-lg font-semibold text-status-blocked">
                  {summary?.outbox_counts.FAILED ?? "—"}
                </span>{" "}
                <span className="text-xs text-muted-foreground">failed</span>
              </Link>
              <Link to="/monitoring?status=PENDING" className="hover:underline">
                <span className="text-lg font-semibold">{summary?.outbox_counts.PENDING ?? "—"}</span>{" "}
                <span className="text-xs text-muted-foreground">pending</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Billing status</CardTitle>
          </CardHeader>
          <CardContent>
            {billing ? (
              <div className="flex flex-wrap gap-3">
                {(Object.entries(billing.counts) as [keyof typeof billing.counts, number][]).map(
                  ([bucket, count]) => (
                    <Link
                      key={bucket}
                      to={`/customers?status=${bucket}`}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-accent"
                      data-testid={`billing-tile-${bucket}`}
                    >
                      <StatusBadge status={bucket} />
                      <span className="font-semibold">{count}</span>
                    </Link>
                  ),
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {notificationsQuery.data?.items.length ? (
              <ul className="space-y-2">
                {notificationsQuery.data.items.slice(0, 5).map((n) => (
                  <li key={n.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{n.alert_rule_name}</p>
                      <p className="text-muted-foreground">{n.summary}</p>
                    </div>
                    <StatusBadge status={n.resolved_at ? "RESOLVED" : "FIRING"} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No alerts fired yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
