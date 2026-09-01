import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/use-toast";
import {
  useCancelSubscription,
  useReactivateSubscription,
  useSuspendSubscription,
} from "@/api/billing";
import type { Subscription } from "@/api/types";

/**
 * The ONE place suspend/reactivate/cancel are wired up — reused by both the customer detail
 * billing tab and the billing overview page, so there is never a second copy of this mutation
 * logic (acceptance criteria: same mutation used everywhere). Keyed by customer_id since the
 * 2026-09-01 split moved billing onto the paying Customer, not any one Client connector.
 */
export function SubscriptionActions({
  customerId,
  subscription,
}: {
  customerId: string;
  subscription: Subscription | null | undefined;
}) {
  const [dialog, setDialog] = useState<"suspend" | "reactivate" | "cancel" | null>(null);
  const suspend = useSuspendSubscription(customerId);
  const reactivate = useReactivateSubscription(customerId);
  const cancel = useCancelSubscription(customerId);

  const isSuspended = subscription?.status === "SUSPENDED";
  const isCancelled = subscription?.status === "CANCELLED";

  function handleSuccess(message: string) {
    toast({ title: message });
    setDialog(null);
  }
  function handleError(err: unknown) {
    toast({
      title: "Action failed",
      description: err instanceof Error ? err.message : "Unknown error",
      variant: "destructive",
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {!isSuspended && !isCancelled && (
        <Button variant="destructive" size="sm" onClick={() => setDialog("suspend")}>
          Suspend
        </Button>
      )}
      {isSuspended && (
        <Button variant="default" size="sm" onClick={() => setDialog("reactivate")}>
          Reactivate
        </Button>
      )}
      {!isCancelled && (
        <Button variant="outline" size="sm" onClick={() => setDialog("cancel")}>
          Cancel subscription
        </Button>
      )}

      <ConfirmDialog
        open={dialog === "suspend"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Suspend this customer?"
        description="This immediately blocks every connector's API call, regardless of paid-through date."
        requireReason
        variant="destructive"
        confirmLabel="Suspend"
        isPending={suspend.isPending}
        onConfirm={(reason) =>
          suspend.mutate(reason!, {
            onSuccess: () => handleSuccess("Customer suspended."),
            onError: handleError,
          })
        }
      />

      <ConfirmDialog
        open={dialog === "reactivate"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Reactivate this customer?"
        description="Clears the suspension. This is the only thing that lifts it — renewing the period does not."
        confirmLabel="Reactivate"
        isPending={reactivate.isPending}
        onConfirm={() =>
          reactivate.mutate(undefined, {
            onSuccess: () => handleSuccess("Customer reactivated."),
            onError: handleError,
          })
        }
      />

      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Cancel this subscription?"
        description="Permanent — distinct from suspension. This cannot be undone from the portal."
        confirmPhrase="CANCEL SUBSCRIPTION"
        variant="destructive"
        confirmLabel="Cancel subscription"
        isPending={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(undefined, {
            onSuccess: () => handleSuccess("Subscription cancelled."),
            onError: handleError,
          })
        }
      />
    </div>
  );
}
