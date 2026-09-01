import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useCustomer, useAttachBranch } from "@/api/customers";
import { useSubscription, useCustomerInvoices } from "@/api/billing";
import { useCustomerActivity } from "@/api/monitoring";
import { useAllBranches } from "@/api/branches";
import { deriveBillingStatus } from "@/lib/billingStatus";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { BlockedCustomerBanner } from "@/features/customers/BlockedCustomerBanner";
import { SubscriptionActions } from "@/features/billing/SubscriptionActions";
import { ConnectorsTab } from "@/features/customers/ConnectorsTab";
import { AuditLogTable } from "@/features/audit-log/AuditLogTable";
import { toast } from "@/components/ui/use-toast";
import type { Invoice } from "@/api/types";

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "overview";

  const customerQuery = useCustomer(id);
  const subscriptionQuery = useSubscription(id);
  const invoicesQuery = useCustomerInvoices(id);
  const branchesQuery = useAllBranches();
  const [attachBranchCode, setAttachBranchCode] = useState("");

  const customer = customerQuery.data;
  const attachBranch = useAttachBranch(id!, customer?.branch_codes ?? []);
  const activity = useCustomerActivity(customer?.branch_codes ?? []);

  if (customerQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (customerQuery.isError || !customer) {
    return <p className="text-sm text-destructive">Customer not found.</p>;
  }

  const status = deriveBillingStatus(subscriptionQuery.data);

  return (
    <div>
      <PageHeader title={customer.name} description={`Customer ID: ${customer.id}`} />

      <BlockedCustomerBanner status={status} subscription={subscriptionQuery.data} />

      <Tabs value={tab} onValueChange={(next) => setSearchParams({ tab: next }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="connectors">Connectors</TabsTrigger>
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
              <SubscriptionActions customerId={customer.id} subscription={subscriptionQuery.data} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connectors">
          <ConnectorsTab customerId={customer.id} />
        </TabsContent>

        <TabsContent value="branches">
          <Card>
            <CardHeader>
              <CardTitle>Allowed branches ({customer.branch_codes.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-1 text-sm">
                {customer.branch_codes.length === 0 && (
                  <li className="text-muted-foreground">No branches attached yet.</li>
                )}
                {customer.branch_codes.map((branchCode) => (
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
                  {branchesQuery.data
                    ?.filter((b) => !customer.branch_codes.includes(b.branch_code))
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
                      onError: (err) =>
                        toast({
                          title: "Failed to attach branch",
                          description: err instanceof Error ? err.message : "Unknown error",
                          variant: "destructive",
                        }),
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
                <SubscriptionActions customerId={customer.id} subscription={subscriptionQuery.data} />
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
              <CardTitle>Recent calls (across this customer's branches)</CardTitle>
            </CardHeader>
            <CardContent>
              {activity.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : activity.entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {activity.entries.slice(0, 20).map((call) => (
                    <li
                      key={`${call.protocol}-${call.id}`}
                      className="flex items-center justify-between border-b pb-2 last:border-0"
                    >
                      <span>
                        [{call.protocol}] {call.endpoint} — {call.branch_code}
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
          <AuditLogTable targetType="customer" targetId={customer.id} />
        </TabsContent>
      </Tabs>
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
