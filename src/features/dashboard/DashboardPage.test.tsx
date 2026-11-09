import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { renderWithProviders } from "@/test/test-utils";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import type { MonitoringSummary } from "@/api/types";

const summary: MonitoringSummary = {
  kra_call_success_rate_1h: 0.92,
  kra_call_success_rate_24h: 0.88,
  outbox_counts: { PENDING: 3, RETRYING: 1, FAILED: 5, SENT: 40, CANCELLED: 0 },
  stale_branch_count: 1,
  blocked_customer_count: 2,
  worst_sync_offender: {
    branch_code: "MOMBASA-PORT",
    resource: "stock_moves",
    last_req_dt: new Date(Date.now() - 47 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 47 * 60 * 1000).toISOString(),
    lag_seconds: 47 * 60,
  },
};

describe("DashboardPage", () => {
  it("renders each tile correctly from a mocked summary payload", async () => {
    server.use(
      http.get("*/v1/admin/monitoring/summary", () => HttpResponse.json(summary)),
    );

    renderWithProviders(<DashboardPage />, { route: "/dashboard" });

    await waitFor(() => expect(screen.getByText("92.0%")).toBeInTheDocument());
    expect(screen.getByText("88.0%")).toBeInTheDocument();
    expect(screen.getByText(/stock_moves — MOMBASA-PORT/)).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument(); // failed outbox count
    expect(screen.getByText("3")).toBeInTheDocument(); // pending outbox count
  });

  it("picks the correct worst sync offender from a mixed sync-status fixture", async () => {
    server.use(
      http.get("*/v1/admin/monitoring/summary", () =>
        HttpResponse.json({
          ...summary,
          worst_sync_offender: {
            branch_code: "KISUMU-WEST",
            resource: "purchases",
            last_req_dt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
            lag_seconds: 2 * 24 * 60 * 60,
          },
        }),
      ),
    );

    renderWithProviders(<DashboardPage />, { route: "/dashboard" });

    await waitFor(() => expect(screen.getByText(/purchases — KISUMU-WEST/)).toBeInTheDocument());
  });
});
