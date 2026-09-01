import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useBranch, useBranchCallLog } from "@/api/branches";
import { formatDate, formatDateTime, formatRelativeToNow } from "@/lib/format";

export function BranchDetailPage() {
  const { branchCode } = useParams<{ branchCode: string }>();
  const branchQuery = useBranch(branchCode);
  const callsQuery = useBranchCallLog(branchCode);

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

      <Card>
        <CardHeader>
          <CardTitle>Device metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Branch id</dt>
              <dd className="font-mono">{branch.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Device type</dt>
              <dd>{branch.device_type}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Registered</dt>
              <dd>{formatDate(branch.created_at)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            cmc_key is never exposed by any endpoint, including this one — there is no
            fingerprint or rotation timestamp field for it in the real branch read-model.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>VSCU health</CardTitle>
        </CardHeader>
        <CardContent>
          {branch.vscu ? (
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Base URL</dt>
                <dd className="font-mono">{branch.vscu.base_url}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Initialized</dt>
                <dd>{formatDate(branch.vscu.initialized_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last successful call</dt>
                <dd>{formatRelativeToNow(branch.vscu.last_successful_call_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last sequence sync</dt>
                <dd>{formatRelativeToNow(branch.vscu.last_sequence_sync_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last known invoice no.</dt>
                <dd>{branch.vscu.last_known_invc_no ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last known sale receipt no.</dt>
                <dd>{branch.vscu.last_known_sale_rcpt_no ?? "—"}</dd>
              </div>
              {branch.vscu.last_error && (
                <div className="col-span-full">
                  <dt className="text-muted-foreground">Last error</dt>
                  <dd className="font-mono text-xs text-status-blocked">{branch.vscu.last_error}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              {branch.device_type === "OSCU"
                ? "OSCU branches have no VSCU device-state tracking."
                : "No VSCU device state recorded yet."}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent calls</CardTitle>
        </CardHeader>
        <CardContent>
          {callsQuery.data?.length ? (
            <ul className="space-y-2 text-sm">
              {callsQuery.data.map((call) => (
                <li key={`${call.protocol}-${call.id}`} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <span>
                    [{call.protocol}] {call.endpoint}
                  </span>
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
