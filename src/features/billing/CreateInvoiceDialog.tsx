import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useCreateInvoice } from "@/api/billing";

/**
 * The only UI path to POST /v1/billing/customers/{customer_id}/invoices — the mutation
 * (useCreateInvoice) existed in api/billing.ts but nothing ever called it, so there was no way
 * to raise an invoice from the admin portal; invoices could only be viewed and marked paid
 * once they already existed. Amount is sent as the raw string the backend expects (it's typed
 * as `string` in api/types.ts to preserve decimal precision, not a JS number).
 */
export function CreateInvoiceDialog({ customerId }: { customerId: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [notes, setNotes] = useState("");
  const createInvoice = useCreateInvoice(customerId);

  function handleOpenChange(next: boolean) {
    if (next) {
      setPeriodStart("");
      setPeriodEnd("");
      setAmount("");
      setCurrency("KES");
      setNotes("");
    }
    setOpen(next);
  }

  const canSubmit = !!periodStart && !!periodEnd && !!amount.trim();

  function handleSubmit() {
    if (!canSubmit) return;
    createInvoice.mutate(
      {
        period_start: new Date(periodStart).toISOString(),
        period_end: new Date(periodEnd).toISOString(),
        amount: amount.trim(),
        currency: currency.trim() || "KES",
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (invoice) => {
          toast({ title: "Invoice raised." });
          setOpen(false);
          navigate(`/billing/invoices/${invoice.id}`);
        },
        onError: (err) =>
          toast({
            title: "Failed to raise invoice",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">New invoice</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise an invoice</DialogTitle>
          <DialogDescription>Records a bill for this customer. It's issued as unpaid.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="period-start">Period start</Label>
              <Input id="period-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-end">Period end</Label>
              <Input id="period-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. September plan renewal" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={createInvoice.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || createInvoice.isPending}>
            {createInvoice.isPending ? "Raising…" : "Raise invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
