import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { renderWithProviders } from "@/test/test-utils";
import { SubscriptionActions } from "@/features/billing/SubscriptionActions";
import type { Subscription } from "@/api/types";

const activeSubscription: Subscription = {
  customer_id: "c1",
  plan_name: "STANDARD",
  status: "ACTIVE",
  current_period_end: "2027-01-01T00:00:00Z",
  grace_period_days: null,
  suspended_at: null,
  suspended_reason: null,
};

describe("SubscriptionActions", () => {
  it("blocks suspend confirmation until a reason is typed, then submits it", async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;
    server.use(
      http.post("*/v1/billing/subscriptions/c1/suspend", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ...activeSubscription, status: "SUSPENDED" });
      }),
    );

    renderWithProviders(<SubscriptionActions customerId="c1" subscription={activeSubscription} />);

    await user.click(screen.getByRole("button", { name: /suspend/i }));
    const dialog = screen.getByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Suspend" });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText(/reason \(required\)/i), "Chargeback on invoice INV-002");
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    await waitFor(() =>
      expect(capturedBody).toEqual({ reason: "Chargeback on invoice INV-002" }),
    );
  });

  it("blocks cancel confirmation until the exact confirm phrase is typed", async () => {
    const user = userEvent.setup();
    let cancelCalled = false;
    server.use(
      http.post("*/v1/billing/subscriptions/c1/cancel", () => {
        cancelCalled = true;
        return HttpResponse.json({ ...activeSubscription, status: "CANCELLED" });
      }),
    );

    renderWithProviders(<SubscriptionActions customerId="c1" subscription={activeSubscription} />);

    await user.click(screen.getByRole("button", { name: /cancel subscription/i }));
    const dialog = screen.getByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Cancel subscription" });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText(/type/i), "wrong phrase");
    expect(confirmButton).toBeDisabled();

    await user.clear(screen.getByLabelText(/type/i));
    await user.type(screen.getByLabelText(/type/i), "CANCEL SUBSCRIPTION");
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    await waitFor(() => expect(cancelCalled).toBe(true));
  });
});
