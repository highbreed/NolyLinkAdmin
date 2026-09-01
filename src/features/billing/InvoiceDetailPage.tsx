import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInvoice, useMarkInvoicePaid } from "@/api/billing";
import { formatDate, formatMoney } from "@/lib/format";
import { toast } from "@/components/ui/use-toast";

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const invoiceQuery = useInvoice(id);
  const markPaid = useMarkInvoicePaid(id!);
  const [extendTo, setExtendTo] = useState("");

  if (invoiceQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (invoiceQuery.isError || !invoiceQuery.data) return <p className="text-sm text-destructive">Invoice not found.</p>;

  const invoice = invoiceQuery.data;

  return (
    <div className="max-w-xl space-y-4">
      <PageHeader
        title={invoice.id}
        description={
          <>
            Customer:{" "}
            <Link to={`/customers/${invoice.customer_id}`} className="text-primary hover:underline">
              {invoice.customer_id}
            </Link>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Invoice details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <StatusBadge status={invoice.status === "PAID" ? "ACTIVE" : "GRACE"} />
            <span className="text-lg font-semibold">{formatMoney(invoice.amount, invoice.currency)}</span>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-muted-foreground">Period</dt>
              <dd>
                {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Issued</dt>
              <dd>{formatDate(invoice.issued_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Paid at</dt>
              <dd>{formatDate(invoice.paid_at)}</dd>
            </div>
          </dl>
          {invoice.notes && (
            <div>
              <dt className="text-muted-foreground">Notes</dt>
              <dd>{invoice.notes}</dd>
            </div>
          )}
        </CardContent>
      </Card>

      {invoice.status === "ISSUED" && (
        <Card>
          <CardHeader>
            <CardTitle>Mark as paid</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="extend-to">Extend subscription to (optional)</Label>
              <Input
                id="extend-to"
                type="date"
                value={extendTo}
                onChange={(e) => setExtendTo(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to record payment without touching the subscription's paid-through date.
              </p>
            </div>
            <Button
              disabled={markPaid.isPending}
              onClick={() =>
                markPaid.mutate(extendTo ? new Date(extendTo).toISOString() : null, {
                  onSuccess: () => toast({ title: "Invoice marked as paid." }),
                  onError: (err) =>
                    toast({
                      title: "Failed to mark invoice paid",
                      description: err instanceof Error ? err.message : "Unknown error",
                      variant: "destructive",
                    }),
                })
              }
            >
              {markPaid.isPending ? "Recording…" : "Mark as paid"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
