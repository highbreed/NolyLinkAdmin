import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { renderWithProviders } from "@/test/test-utils";
import { BranchDetailPage } from "@/features/branches/BranchDetailPage";
import { Routes, Route } from "react-router-dom";

// A real, un-truncated cmc_key shape — if a fixture or API response ever accidentally
// included the raw key, this regression test would catch it appearing anywhere in the DOM.
// The real GET /v1/admin/branches/{code} response has no cmc_key-shaped field at all (there's
// no masked-fingerprint UI to assert on either) — this fixture simulates a hypothetical future
// response bug leaking the raw key under an unexpected field name, which the page must still
// never render regardless of what the API happens to send.
const RAW_CMC_KEY = "cmc_live_9f8e7d6c5b4a3210abcdefabcdefabcd";

describe("BranchDetailPage — cmc_key must never render", () => {
  it("never renders a raw cmc_key anywhere, even if a response leaked it", async () => {
    server.use(
      http.get("*/v1/admin/branches/NAIROBI-HQ", () =>
        HttpResponse.json({
          id: "b-0001",
          branch_code: "NAIROBI-HQ",
          tin: "A123456789Z",
          bhf_id: "00",
          status: "ACTIVE",
          device_type: "OSCU",
          created_at: "2026-01-01T00:00:00Z",
          vscu: null,
          cmc_key: RAW_CMC_KEY,
        }),
      ),
      http.get("*/v1/admin/call-logs", () => HttpResponse.json([])),
    );

    renderWithProviders(
      <Routes>
        <Route path="/branches/:branchCode" element={<BranchDetailPage />} />
      </Routes>,
      { route: "/branches/NAIROBI-HQ" },
    );

    await waitFor(() => expect(screen.getByText("NAIROBI-HQ")).toBeInTheDocument());

    expect(document.body.textContent).not.toContain(RAW_CMC_KEY);
    expect(document.body.innerHTML).not.toContain(RAW_CMC_KEY);
  });
});
