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
 * The ONE place suspend/reactivate/cancel are wired up — reused by both the client detail
 * billing tab and the billing overview page, so there is never a second copy of this mutation
 * logic (acceptance criteria: same mutation used everywhere).
 */
export function SubscriptionActions({
  clientId,
  subscription,
}: {
  clientId: string;
  subscription: Subscription | null | undefined;
}) {
  const [dialog, setDialog] = useState<"suspend" | "reactivate" | "cancel" | null>(null);
  const suspend = useSuspendSubscription(clientId);
  const reactivate = useReactivateSubscription(clientId);
  const cancel = useCancelSubscription(clientId);

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
        title="Suspend this client?"
        description="This immediately blocks every client-bearer API call, regardless of paid-through date."
        requireReason
        variant="destructive"
        confirmLabel="Suspend"
        isPending={suspend.isPending}
        onConfirm={(reason) =>
          suspend.mutate(reason!, {
            onSuccess: () => handleSuccess("Client suspended."),
            onError: handleError,
          })
        }
      />

      <ConfirmDialog
        open={dialog === "reactivate"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Reactivate this client?"
        description="Clears the suspension. This is the only thing that lifts it — renewing the period does not."
        confirmLabel="Reactivate"
        isPending={reactivate.isPending}
        onConfirm={() =>
          reactivate.mutate(undefined, {
            onSuccess: () => handleSuccess("Client reactivated."),
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
