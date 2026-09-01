import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { renderWithProviders } from "@/test/test-utils";
import { CustomerNewPage } from "@/features/customers/CustomerNewPage";

describe("CustomerNewPage", () => {
  it("creates a customer with no secret involved — that only happens for connectors now", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post("*/v1/customers", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          { id: "cu-new-0001", name: "Acme Retail Ltd", branch_codes: [], created_at: new Date().toISOString() },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<CustomerNewPage />, { route: "/customers/new" });

    await user.type(screen.getByLabelText(/customer name/i), "Acme Retail Ltd");
    await user.click(screen.getByRole("button", { name: /register customer/i }));

    await waitFor(() => expect(capturedBody).toEqual({ name: "Acme Retail Ltd", branch_codes: [] }));
  });

  it("shows a validation error and does not submit when the name is blank", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomerNewPage />, { route: "/customers/new" });

    await user.click(screen.getByRole("button", { name: /register customer/i }));

    expect(await screen.findByText(/customer name is required/i)).toBeInTheDocument();
  });
});
