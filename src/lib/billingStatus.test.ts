import { describe, expect, it } from "vitest";
import { bucketExpirations, deriveBillingStatus } from "@/lib/billingStatus";
import type { Subscription } from "@/api/types";

const NOW = new Date("2026-08-31T00:00:00Z");

function makeSub(overrides: Partial<Subscription>): Subscription {
  return {
    client_id: "c1",
    plan_name: "STANDARD",
    status: "ACTIVE",
    current_period_end: "2026-09-30T00:00:00Z",
    grace_period_days: null,
    suspended_at: null,
    suspended_reason: null,
    ...overrides,
  };
}

describe("deriveBillingStatus", () => {
  it("returns NO_SUBSCRIPTION when there is no subscription", () => {
    expect(deriveBillingStatus(null, NOW).bucket).toBe("NO_SUBSCRIPTION");
    expect(deriveBillingStatus(undefined, NOW).bucket).toBe("NO_SUBSCRIPTION");
  });

  it("returns CANCELLED regardless of period_end", () => {
    const sub = makeSub({ status: "CANCELLED", current_period_end: "2099-01-01T00:00:00Z" });
    expect(deriveBillingStatus(sub, NOW).bucket).toBe("CANCELLED");
  });

  it("returns SUSPENDED even if the period hasn't lapsed", () => {
    const sub = makeSub({ status: "SUSPENDED", current_period_end: "2099-01-01T00:00:00Z" });
    expect(deriveBillingStatus(sub, NOW).bucket).toBe("SUSPENDED");
  });

  it("returns ACTIVE while now <= current_period_end", () => {
    const sub = makeSub({ current_period_end: "2026-09-01T00:00:00Z" });
    expect(deriveBillingStatus(sub, NOW).bucket).toBe("ACTIVE");
  });

  it("returns GRACE once past period_end but within grace_period_days", () => {
    const sub = makeSub({ current_period_end: "2026-08-29T00:00:00Z", grace_period_days: 7 });
    const result = deriveBillingStatus(sub, NOW);
    expect(result.bucket).toBe("GRACE");
    expect(result.graceDaysRemaining).toBe(5);
  });

  it("falls back to the default 7-day grace period when grace_period_days is null", () => {
    const sub = makeSub({ current_period_end: "2026-08-29T00:00:00Z", grace_period_days: null });
    expect(deriveBillingStatus(sub, NOW).bucket).toBe("GRACE");
  });

  it("returns BLOCKED once past period_end + grace_period_days", () => {
    const sub = makeSub({ current_period_end: "2026-08-01T00:00:00Z", grace_period_days: 7 });
    expect(deriveBillingStatus(sub, NOW).bucket).toBe("BLOCKED");
  });
});

describe("bucketExpirations", () => {
  it("buckets hard-blocked, in-grace, and expiring-soon clients, sorted by urgency", () => {
    const input = [
      { clientId: "blocked", subscription: makeSub({ current_period_end: "2026-08-01T00:00:00Z", grace_period_days: 7 }) },
      { clientId: "grace", subscription: makeSub({ current_period_end: "2026-08-29T00:00:00Z", grace_period_days: 7 }) },
      { clientId: "expiring", subscription: makeSub({ current_period_end: "2026-09-03T00:00:00Z" }) },
      { clientId: "far-future", subscription: makeSub({ current_period_end: "2027-01-01T00:00:00Z" }) },
      { clientId: "no-sub", subscription: null },
    ];

    const result = bucketExpirations(input, 7, NOW);

    expect(result.map((r) => r.clientId)).toEqual(["blocked", "grace", "expiring"]);
    expect(result[0].bucket).toBe("hard_blocked");
    expect(result[1].bucket).toBe("in_grace");
    expect(result[2].bucket).toBe("expiring_soon");
  });

  it("excludes clients expiring further out than the window", () => {
    const input = [{ clientId: "later", subscription: makeSub({ current_period_end: "2026-12-01T00:00:00Z" }) }];
    expect(bucketExpirations(input, 7, NOW)).toEqual([]);
  });
});
