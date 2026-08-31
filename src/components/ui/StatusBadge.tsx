/**
 * The single status-badge component for every status vocabulary in the portal (client billing
 * status, branch status, outbox status, alert firing/resolved) — variant-driven, not five
 * hand-rolled badges. Every status pairs an icon + text label with its color so nothing here
 * relies on color alone (color-blind-safe requirement).
 */
import { CheckCircle2, Clock, XCircle, Ban, MinusCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { BillingStatusBucket } from "@/lib/billingStatus";
import type { BranchStatus, OutboxStatus } from "@/api/types";

type AlertStatus = "FIRING" | "RESOLVED";

type AnyStatus = BillingStatusBucket | BranchStatus | OutboxStatus | AlertStatus;

interface StatusMeta {
  label: string;
  variant: "active" | "grace" | "blocked" | "neutral";
  Icon: typeof CheckCircle2;
}

const STATUS_MAP: Record<AnyStatus, StatusMeta> = {
  // Billing
  ACTIVE: { label: "Active", variant: "active", Icon: CheckCircle2 },
  GRACE: { label: "In grace period", variant: "grace", Icon: Clock },
  BLOCKED: { label: "Blocked", variant: "blocked", Icon: XCircle },
  SUSPENDED: { label: "Suspended", variant: "blocked", Icon: AlertTriangle },
  CANCELLED: { label: "Cancelled", variant: "neutral", Icon: Ban },
  NO_SUBSCRIPTION: { label: "No subscription", variant: "neutral", Icon: MinusCircle },
  // Outbox (SENT reuses "active" green, FAILED reuses "blocked" red)
  PENDING: { label: "Pending", variant: "neutral", Icon: Clock },
  RETRYING: { label: "Retrying", variant: "grace", Icon: Clock },
  FAILED: { label: "Failed", variant: "blocked", Icon: XCircle },
  SENT: { label: "Sent", variant: "active", Icon: CheckCircle2 },
  // Alerts
  FIRING: { label: "Firing", variant: "blocked", Icon: AlertTriangle },
  RESOLVED: { label: "Resolved", variant: "active", Icon: CheckCircle2 },
};

export function StatusBadge({ status, className }: { status: AnyStatus; className?: string }) {
  const meta = STATUS_MAP[status];
  if (!meta) {
    return <Badge variant="neutral" className={className}>{status}</Badge>;
  }
  const { label, variant, Icon } = meta;
  return (
    <Badge variant={variant} className={cn(className)}>
      <Icon aria-hidden="true" className="h-3 w-3" />
      <span>{label}</span>
    </Badge>
  );
}
