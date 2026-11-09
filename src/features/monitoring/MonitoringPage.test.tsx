import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/mocks/server";
import { renderWithProviders } from "@/test/test-utils";
import { MonitoringPage } from "@/features/monitoring/MonitoringPage";
import type { OutboxItem, Page } from "@/api/types";

const failedItem: OutboxItem = {
  id: "ob-test-1",
  endpoint: "/v1/purchases",
  branch_code: "MOMBASA-PORT",
  customer_id: "c1",
  customer_name: "Coastal Retail Group",
  status: "FAILED",
  attempts: 5,
  last_error: "KRA 999",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function outboxPage(item: OutboxItem): Page<OutboxItem> {
  return { items: [item], total: 1, page: 1, page_size: 20 };
}

describe("MonitoringPage — outbox retry", () => {
  it("optimistically flips the row to Pending immediately, then rolls back on a failed retry", async () => {
    server.use(
      http.get("*/v1/admin/monitoring/kra-calls/timeseries", () => HttpResponse.json([])),
      http.get("*/v1/admin/monitoring/sync-status", () => HttpResponse.json([])),
      http.get("*/v1/admin/monitoring/outbox", () => HttpResponse.json(outboxPage(failedItem))),
      http.post("*/v1/admin/monitoring/outbox/:id/retry", async () => {
        await delay(50);
        return HttpResponse.json({ detail: "still broken" }, { status: 502 });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<MonitoringPage />, { route: "/monitoring" });

    const row = await screen.findByText("/v1/purchases");
    const tr = row.closest("tr")!;
    expect(within(tr).getByText("Failed")).toBeInTheDocument();

    await user.click(within(tr).getByRole("button", { name: /retry/i }));

    // Optimistic update: row shows Pending before the (failing) response resolves.
    await waitFor(() => expect(within(tr).getByText("Pending")).toBeInTheDocument());

    // Once the request fails, the optimistic update is rolled back to Failed.
    await waitFor(() => expect(within(tr).getByText("Failed")).toBeInTheDocument(), { timeout: 2000 });
  });
});
