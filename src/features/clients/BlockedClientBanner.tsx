import { AlertOctagon } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { BillingStatusResult } from "@/lib/billingStatus";
import type { Subscription } from "@/api/types";

/**
 * The "why is this client blocked" plain-language explanation (admin_portal_design.md §8) —
 * deliberately loud (not a small badge) so it's impossible to miss on a blocked client's page.
 */
export function BlockedClientBanner({
  status,
  subscription,
}: {
  status: BillingStatusResult;
  subscription: Subscription | null | undefined;
}) {
  if (status.bucket !== "BLOCKED" && status.bucket !== "SUSPENDED") return null;

  const message =
    status.bucket === "SUSPENDED"
      ? `This client was manually suspended${
          subscription?.suspended_reason ? `: ${subscription.suspended_reason}` : "."
        }`
      : `This client's grace period ended on ${formatDate(status.relevantDate?.toISOString())}. Every client-bearer API call now returns 402 until reactivated or a new period is recorded.`;

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-lg border-2 border-status-blocked bg-status-blocked/5 p-4"
    >
      <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-status-blocked" aria-hidden="true" />
      <div>
        <p className="font-semibold text-status-blocked">This client is blocked from KRA fiscalization</p>
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
}
