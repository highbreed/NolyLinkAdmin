import { useParams } from "react-router-dom";
import { AlertOctagon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useBranch, useBranchCallLog, useBranchSyncState } from "@/api/branches";
import { formatDate, formatDateTime, formatRelativeToNow } from "@/lib/format";

export function BranchDetailPage() {
  const { branchCode } = useParams<{ branchCode: string }>();
  const branchQuery = useBranch(branchCode);
  const callsQuery = useBranchCallLog(branchCode);
  const syncQuery = useBranchSyncState(branchCode);

  if (branchQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (branchQuery.isError || !branchQuery.data) return <p className="text-sm text-destructive">Branch not found.</p>;

  const branch = branchQuery.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title={branch.branch_code}
        description={`TIN ${branch.tin} · BHF ${branch.bhf_id} · ${branch.device_type}`}
        actions={<StatusBadge status={branch.status} />}
      />

      {branch.incident_no_local_record && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border-2 border-status-blocked bg-status-blocked/5 p-4">
          <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-status-blocked" />
          <div>
            <p className="font-semibold text-status-blocked">
              KRA reports this device already installed (902) with no local record
            </p>
            <p className="text-sm">
              This needs manual escalation to ops — the original cmcKey can't be recovered from
              KRA, so there is no self-service re-initialize action here by design.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Device metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">DVC ID</dt>
              <dd className="font-mono">{branch.dvc_id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">SDC ID</dt>
              <dd className="font-mono">{branch.sdc_id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">MRC No</dt>
              <dd className="font-mono">{branch.mrc_no ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">cmc_key (masked)</dt>
              <dd className="font-mono" data-testid="cmc-key-fingerprint">
                {branch.cmc_key_fingerprint ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last rotated</dt>
              <dd>{formatDate(branch.cmc_key_last_rotated_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Base URL override</dt>
              <dd className="font-mono">{branch.kra_base_url_override ?? "default"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sync state per resource</CardTitle>
        </CardHeader>
        <CardContent>
          {syncQuery.data?.length ? (
            <ul className="space-y-2 text-sm">
              {syncQuery.data.map((row) => (
                <li key={row.resource} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <span>{row.resource}</span>
                  <span className="text-muted-foreground">last synced {formatRelativeToNow(row.last_req_dt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No sync state recorded.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent KRA calls</CardTitle>
        </CardHeader>
        <CardContent>
          {callsQuery.data?.items.length ? (
            <ul className="space-y-2 text-sm">
              {callsQuery.data.items.map((call) => (
                <li key={call.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <span>{call.endpoint}</span>
                  <span className="text-muted-foreground">
                    {call.result_cd} · {formatDateTime(call.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No recent calls.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
