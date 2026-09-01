import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { renderWithProviders } from "@/test/test-utils";
import { CustomerNewPage } from "@/features/customers/CustomerNewPage";
import type { CustomerOnboardRequest, CustomerOnboardResponse } from "@/api/types";

describe("CustomerNewPage — onboarding stepper", () => {
  it("shows a validation error and does not submit when the name is blank", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomerNewPage />, { route: "/customers/new" });

    await user.click(screen.getByRole("button", { name: /^onboard customer$/i }));

    expect(await screen.findByText(/customer name is required/i)).toBeInTheDocument();
  });

  it("onboards a customer with two branches and shows REGISTERED for both", async () => {
    let captured: CustomerOnboardRequest | null = null;
    server.use(
      http.post("*/v1/customers/onboard", async ({ request }) => {
        captured = (await request.json()) as CustomerOnboardRequest;
        const response: CustomerOnboardResponse = {
          customer: { id: "cu-new", name: "Multi Branch Co", branch_codes: ["BR-1", "BR-2"], created_at: new Date().toISOString() },
          branches: [
            { branch_code: "BR-1", device_type: "OSCU", status: "REGISTERED", branch_id: "b-1", error: null },
            { branch_code: "BR-2", device_type: "OSCU", status: "REGISTERED", branch_id: "b-2", error: null },
          ],
        };
        return HttpResponse.json(response, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<CustomerNewPage />, { route: "/customers/new" });

    await user.type(screen.getByLabelText(/customer name/i), "Multi Branch Co");

    await user.click(screen.getByRole("button", { name: /add branch/i }));
    await user.type(screen.getByLabelText(/branch code/i), "BR-1");
    await user.type(screen.getByLabelText(/^tin$/i), "A111111111Z");
    await user.type(screen.getByLabelText(/bhf id/i), "00");

    await user.click(screen.getByRole("button", { name: /add branch/i }));
    const branchCodeInputs = screen.getAllByLabelText(/branch code/i);
    await user.type(branchCodeInputs[1], "BR-2");
    const tinInputs = screen.getAllByLabelText(/^tin$/i);
    await user.type(tinInputs[1], "A222222222Z");
    const bhfInputs = screen.getAllByLabelText(/bhf id/i);
    await user.type(bhfInputs[1], "01");

    await user.click(screen.getByRole("button", { name: /^onboard customer$/i }));

    await waitFor(() => expect(screen.getByText(/customer onboarded/i)).toBeInTheDocument());
    expect(captured).not.toBeNull();
    expect(captured!.branches).toHaveLength(2);
    expect(screen.getAllByText("Registered")).toHaveLength(2);
  });

  it("shows a per-branch FAILED status and error without blocking the whole result", async () => {
    server.use(
      http.post("*/v1/customers/onboard", async () => {
        const response: CustomerOnboardResponse = {
          customer: { id: "cu-partial", name: "Partial Co", branch_codes: ["BR-OK"], created_at: new Date().toISOString() },
          branches: [
            { branch_code: "BR-OK", device_type: "OSCU", status: "REGISTERED", branch_id: "b-1", error: null },
            {
              branch_code: "BR-DUP",
              device_type: "OSCU",
              status: "FAILED",
              branch_id: null,
              error: "(tin, bhfId) is already registered under a different customer ('Someone Else') — check for a data-entry mistake",
            },
          ],
        };
        return HttpResponse.json(response, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<CustomerNewPage />, { route: "/customers/new" });

    await user.type(screen.getByLabelText(/customer name/i), "Partial Co");
    await user.click(screen.getByRole("button", { name: /add branch/i }));
    await user.type(screen.getByLabelText(/branch code/i), "BR-OK");
    await user.type(screen.getByLabelText(/^tin$/i), "A111111111Z");
    await user.type(screen.getByLabelText(/bhf id/i), "00");
    await user.click(screen.getByRole("button", { name: /^onboard customer$/i }));

    await waitFor(() => expect(screen.getByText("Registered")).toBeInTheDocument());
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText(/already registered under a different customer/i)).toBeInTheDocument();
    expect(screen.getByText(/1 branch failed to register/i)).toBeInTheDocument();
  });

  it("requires a base_url for a VSCU branch before submitting", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomerNewPage />, { route: "/customers/new" });

    await user.type(screen.getByLabelText(/customer name/i), "VSCU Co");
    await user.click(screen.getByRole("button", { name: /add branch/i }));
    await user.type(screen.getByLabelText(/branch code/i), "BR-VSCU");
    await user.type(screen.getByLabelText(/^tin$/i), "A333333333Z");
    await user.type(screen.getByLabelText(/bhf id/i), "02");
    await user.selectOptions(screen.getByLabelText(/device type/i), "VSCU");
    await user.click(screen.getByRole("button", { name: /^onboard customer$/i }));

    expect(await screen.findByText(/base_url is required for vscu branches/i)).toBeInTheDocument();
  });
});
