import { useState } from "react";
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
import { toast } from "@/components/ui/use-toast";
import { useUpsertSubscription } from "@/api/billing";
import type { Subscription } from "@/api/types";

/**
 * The only UI path to PUT /v1/billing/subscriptions/{customer_id} — until this existed, a
 * newly onboarded customer had no way to get a plan set from the admin portal at all (the
 * mutation was wired up in api/billing.ts but never called from anywhere). Upsert per the
 * backend: creates if none exists, else renews plan_name/current_period_end/grace_period_days.
 * Never touches status, so this can't lift a SUSPENDED/CANCELLED subscription — that's what
 * SubscriptionActions' reactivate button is for.
 */
export function SetPlanDialog({
  customerId,
  subscription,
}: {
  customerId: string;
  subscription: Subscription | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [planName, setPlanName] = useState("STANDARD");
  const [periodEnd, setPeriodEnd] = useState("");
  const [graceDays, setGraceDays] = useState("");
  const upsert = useUpsertSubscription(customerId);

  const isRenewal = !!subscription;

  function handleOpenChange(next: boolean) {
    if (next) {
      setPlanName(subscription?.plan_name ?? "STANDARD");
      setPeriodEnd("");
      setGraceDays(subscription?.grace_period_days != null ? String(subscription.grace_period_days) : "");
    }
    setOpen(next);
  }

  function handleSubmit() {
    if (!planName.trim() || !periodEnd) return;
    upsert.mutate(
      {
        plan_name: planName.trim(),
        current_period_end: new Date(periodEnd).toISOString(),
        grace_period_days: graceDays ? Number(graceDays) : null,
      },
      {
        onSuccess: () => {
          toast({ title: isRenewal ? "Plan renewed." : "Plan set up." });
          setOpen(false);
        },
        onError: (err) =>
          toast({
            title: "Failed to save plan",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant={isRenewal ? "outline" : "default"}>
          {isRenewal ? "Renew plan" : "Set up plan"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isRenewal ? "Renew subscription" : "Set up a plan"}</DialogTitle>
          <DialogDescription>
            {isRenewal
              ? "Updates the plan and paid-through date. This never lifts a suspended or cancelled subscription."
              : "Creates this customer's first subscription."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan-name">Plan name</Label>
            <Input
              id="plan-name"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="STANDARD"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period-end">Paid through</Label>
            <Input
              id="period-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grace-days">Grace period days (optional)</Label>
            <Input
              id="grace-days"
              type="number"
              min="0"
              value={graceDays}
              onChange={(e) => setGraceDays(e.target.value)}
              placeholder="Defaults to the global setting (7 days)"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={upsert.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!planName.trim() || !periodEnd || upsert.isPending}>
            {upsert.isPending ? "Saving…" : isRenewal ? "Renew" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
