/**
 * Derives the client-facing billing status bucket from a raw Subscription record.
 *
 * Mirrors app/services/billing_service.py's enforcement rules (docs/api_reference.md
 * "Admin — Billing"): `status` is only ACTIVE/SUSPENDED/CANCELLED on the backend — "in grace
 * period" and "hard blocked" are never stored, they're computed from `current_period_end` +
 * `grace_period_days` at request time. This is the frontend's read-only mirror of that same
 * computation, purely for display/filtering — it must never be treated as authoritative
 * (the real 402 enforcement always happens server-side).
 */
import type { Subscription } from "@/api/types";

export const DEFAULT_GRACE_PERIOD_DAYS = 7;

export type BillingStatusBucket =
  | "ACTIVE"
  | "GRACE"
  | "BLOCKED"
  | "SUSPENDED"
  | "CANCELLED"
  | "NO_SUBSCRIPTION";

export interface BillingStatusResult {
  bucket: BillingStatusBucket;
  /** Only set for GRACE/ACTIVE-expiring-soon: when grace ends / period ends. */
  relevantDate: Date | null;
  graceDaysRemaining: number | null;
}

export function deriveBillingStatus(
  subscription: Subscription | null | undefined,
  now: Date = new Date(),
): BillingStatusResult {
  if (!subscription) {
    return { bucket: "NO_SUBSCRIPTION", relevantDate: null, graceDaysRemaining: null };
  }
  if (subscription.status === "CANCELLED") {
    return { bucket: "CANCELLED", relevantDate: null, graceDaysRemaining: null };
  }
  if (subscription.status === "SUSPENDED") {
    return { bucket: "SUSPENDED", relevantDate: null, graceDaysRemaining: null };
  }

  const periodEnd = new Date(subscription.current_period_end);
  const graceDays = subscription.grace_period_days ?? DEFAULT_GRACE_PERIOD_DAYS;
  const graceEnd = new Date(periodEnd.getTime() + graceDays * 24 * 60 * 60 * 1000);

  if (now <= periodEnd) {
    return { bucket: "ACTIVE", relevantDate: periodEnd, graceDaysRemaining: null };
  }
  if (now <= graceEnd) {
    const msRemaining = graceEnd.getTime() - now.getTime();
    return {
      bucket: "GRACE",
      relevantDate: graceEnd,
      graceDaysRemaining: Math.ceil(msRemaining / (24 * 60 * 60 * 1000)),
    };
  }
  return { bucket: "BLOCKED", relevantDate: graceEnd, graceDaysRemaining: null };
}

export interface ExpirationBucket {
  customerId: string;
  bucket: "expiring_soon" | "in_grace" | "hard_blocked";
  relevantDate: Date | null;
}

/**
 * Buckets a set of (customerId, subscription) pairs into the dashboard's proactive
 * "upcoming expirations" groups: already-blocked, currently-in-grace, and active-but-
 * expiring-within-`withinDays`. This is the core "proactive" logic — see design doc §6.1/§8.
 */
export function bucketExpirations(
  subscriptions: Array<{ customerId: string; subscription: Subscription | null }>,
  withinDays = 7,
  now: Date = new Date(),
): ExpirationBucket[] {
  const results: ExpirationBucket[] = [];
  for (const { customerId, subscription } of subscriptions) {
    const status = deriveBillingStatus(subscription, now);
    if (status.bucket === "BLOCKED") {
      results.push({ customerId, bucket: "hard_blocked", relevantDate: status.relevantDate });
    } else if (status.bucket === "GRACE") {
      results.push({ customerId, bucket: "in_grace", relevantDate: status.relevantDate });
    } else if (status.bucket === "ACTIVE" && status.relevantDate) {
      const daysUntil =
        (status.relevantDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
      if (daysUntil <= withinDays) {
        results.push({ customerId, bucket: "expiring_soon", relevantDate: status.relevantDate });
      }
    }
  }
  // Hard-blocked first (most urgent), then in-grace, then expiring-soon — each sorted by
  // how soon the relevant date is.
  const order: Record<ExpirationBucket["bucket"], number> = {
    hard_blocked: 0,
    in_grace: 1,
    expiring_soon: 2,
  };
  return results.sort((a, b) => {
    if (order[a.bucket] !== order[b.bucket]) return order[a.bucket] - order[b.bucket];
    const at = a.relevantDate?.getTime() ?? 0;
    const bt = b.relevantDate?.getTime() ?? 0;
    return at - bt;
  });
}
