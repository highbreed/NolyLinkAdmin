import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { renderWithProviders } from "@/test/test-utils";
import { BranchDetailPage } from "@/features/branches/BranchDetailPage";
import { Routes, Route } from "react-router-dom";

// A real, un-truncated cmc_key shape — if a fixture or API response ever accidentally
// included the raw key, this regression test would catch it appearing anywhere in the DOM.
const RAW_CMC_KEY = "cmc_live_9f8e7d6c5b4a3210abcdefabcdefabcd";

describe("BranchDetailPage — cmc_key must never render", () => {
  it("renders only the masked fingerprint, never the raw cmc_key, even if a response leaked it", async () => {
    server.use(
      http.get("*/admin/api/v1/branches/NAIROBI-HQ", () =>
        HttpResponse.json({
          branch_code: "NAIROBI-HQ",
          tin: "A123456789Z",
          bhf_id: "00",
          status: "ACTIVE",
          device_type: "OSCU",
          kra_base_url_override: null,
          dvc_id: "DVC-0001",
          sdc_id: "SDC-0001",
          mrc_no: "MRC-0001",
          cmc_key_last_rotated_at: "2026-06-01T00:00:00Z",
          cmc_key_fingerprint: "…a91f",
          // A regression fixture: some hypothetical future response bug leaks the raw key
          // under an unexpected field name. The component must never render it regardless.
          cmc_key: RAW_CMC_KEY,
        }),
      ),
      http.get("*/admin/api/v1/monitoring/kra-calls", () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 })),
      http.get("*/admin/api/v1/monitoring/sync-status", () => HttpResponse.json([])),
    );

    renderWithProviders(
      <Routes>
        <Route path="/branches/:branchCode" element={<BranchDetailPage />} />
      </Routes>,
      { route: "/branches/NAIROBI-HQ" },
    );

    await waitFor(() => expect(screen.getByTestId("cmc-key-fingerprint")).toHaveTextContent("…a91f"));

    expect(document.body.textContent).not.toContain(RAW_CMC_KEY);
    expect(document.body.innerHTML).not.toContain(RAW_CMC_KEY);
  });
});
