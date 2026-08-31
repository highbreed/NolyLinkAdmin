import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { KeyRound, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useClient, useRotateClientSecret, useAttachBranch } from "@/api/clients";
import { useSubscription, useClientInvoices } from "@/api/billing";
import { useKraCallsList } from "@/api/monitoring";
import { useBranchesList } from "@/api/branches";
import { deriveBillingStatus } from "@/lib/billingStatus";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { BlockedClientBanner } from "@/features/clients/BlockedClientBanner";
import { SubscriptionActions } from "@/features/billing/SubscriptionActions";
import { SecretOncePanel } from "@/features/clients/SecretOncePanel";
import { AuditLogTable } from "@/features/audit-log/AuditLogTable";
import { toast } from "@/components/ui/use-toast";
import type { ClientSecretOnce, Invoice } from "@/api/types";

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "overview";

  const clientQuery = useClient(id);
  const subscriptionQuery = useSubscription(id);
  const invoicesQuery = useClientInvoices(id);
  const callsQuery = useKraCallsList({ page: 1, pageSize: 20, sort: null, search: "" });
  const branchesQuery = useBranchesList({ page: 1, pageSize: 100, sort: null, search: "" });

  const rotateSecret = useRotateClientSecret(id!);
  const attachBranch = useAttachBranch(id!);
  const [rotated, setRotated] = useState<ClientSecretOnce | null>(null);
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);
  const [attachBranchCode, setAttachBranchCode] = useState("");

  if (clientQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (clientQuery.isError || !clientQuery.data) {
    return <p className="text-sm text-destructive">Client not found.</p>;
  }

  const client = clientQuery.data;
  const status = deriveBillingStatus(subscriptionQuery.data ?? client.subscription);
  const clientCalls = callsQuery.data?.items.filter((c) => c.client_id === client.id) ?? [];

  return (
    <div>
      <PageHeader
        title={client.name}
        description={`Client ID: ${client.id}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => setRotateDialogOpen(true)}>
            <KeyRound className="h-4 w-4" /> Rotate secret
          </Button>
        }
      />

      <BlockedClientBanner status={status} subscription={subscriptionQuery.data} />

      {rotated && (
        <div className="mb-4">
          <SecretOncePanel clientId={rotated.client_id} secret={rotated.client_secret} />
        </div>
      )}

      <Tabs value={tab} onValueChange={(next) => setSearchParams({ tab: next }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Subscription summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={status.bucket} />
                {status.relevantDate && (
                  <span className="text-sm text-muted-foreground">
                    {status.bucket === "GRACE" ? "Grace ends" : "Paid through"} {formatDate(status.relevantDate.toISOString())}
                  </span>
                )}
              </div>
              <SubscriptionActions clientId={client.id} subscription={subscriptionQuery.data ?? client.subscription} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branches">
          <Card>
            <CardHeader>
              <CardTitle>Allowed branches ({client.allowed_branch_ids.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-1 text-sm">
                {client.allowed_branch_ids.length === 0 && (
                  <li className="text-muted-foreground">No branches attached yet.</li>
                )}
                {client.allowed_branch_ids.map((branchCode) => (
                  <li key={branchCode}>
                    <button className="text-primary hover:underline" onClick={() => navigate(`/branches/${branchCode}`)}>
                      {branchCode}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={attachBranchCode}
                  onChange={(e) => setAttachBranchCode(e.target.value)}
                  aria-label="Branch to attach"
                >
                  <option value="">Select a branch…</option>
                  {branchesQuery.data?.items
                    .filter((b) => !client.allowed_branch_ids.includes(b.branch_code))
                    .map((b) => (
                      <option key={b.branch_code} value={b.branch_code}>
                        {b.branch_code}
                      </option>
                    ))}
                </select>
                <Button
                  size="sm"
                  disabled={!attachBranchCode || attachBranch.isPending}
                  onClick={() =>
                    attachBranch.mutate(attachBranchCode, {
                      onSuccess: () => {
                        toast({ title: `${attachBranchCode} attached.` });
                        setAttachBranchCode("");
                      },
                    })
                  }
                >
                  <Plus className="h-4 w-4" /> Attach branch
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Subscription</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatusBadge status={status.bucket} />
                <SubscriptionActions clientId={client.id} subscription={subscriptionQuery.data ?? client.subscription} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                <InvoicesList invoices={invoicesQuery.data ?? []} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent KRA calls</CardTitle>
            </CardHeader>
            <CardContent>
              {clientCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {clientCalls.map((call) => (
                    <li key={call.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <span>
                        {call.endpoint} — {call.branch_code}
                      </span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {call.result_cd}
                        {formatDateTime(call.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogTable targetType="client" targetId={client.id} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={rotateDialogOpen}
        onOpenChange={setRotateDialogOpen}
        title="Rotate this client's secret?"
        description="The old secret is invalidated immediately. The new one is shown exactly once."
        confirmLabel="Rotate secret"
        variant="destructive"
        isPending={rotateSecret.isPending}
        onConfirm={() =>
          rotateSecret.mutate(undefined, {
            onSuccess: (result) => {
              setRotated(result);
              setRotateDialogOpen(false);
            },
          })
        }
      />
    </div>
  );
}

function InvoicesList({ invoices }: { invoices: Invoice[] }) {
  if (!invoices || invoices.length === 0) {
    return <p className="text-sm text-muted-foreground">No invoices yet.</p>;
  }
  return (
    <ul className="space-y-2 text-sm">
      {invoices.map((invoice) => (
        <InvoiceRow key={invoice.id} invoiceId={invoice.id} amount={invoice.amount} currency={invoice.currency} status={invoice.status} issuedAt={invoice.issued_at} />
      ))}
    </ul>
  );
}

function InvoiceRow({
  invoiceId,
  amount,
  currency,
  status,
  issuedAt,
}: {
  invoiceId: string;
  amount: string;
  currency: string;
  status: string;
  issuedAt: string;
}) {
  const navigate = useNavigate();
  return (
    <li className="flex items-center justify-between border-b pb-2 last:border-0">
      <button className="text-primary hover:underline" onClick={() => navigate(`/billing/invoices/${invoiceId}`)}>
        {invoiceId}
      </button>
      <span className="flex items-center gap-3 text-muted-foreground">
        {formatMoney(amount, currency)}
        <span>{status}</span>
        {formatDate(issuedAt)}
      </span>
    </li>
  );
}
