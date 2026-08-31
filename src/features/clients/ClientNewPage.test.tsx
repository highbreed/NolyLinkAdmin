import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { ClientNewPage } from "@/features/clients/ClientNewPage";

describe("ClientNewPage", () => {
  it("creates a client and shows the secret-once panel with the raw secret, exactly once", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientNewPage />, { route: "/clients/new" });

    await user.type(screen.getByLabelText(/client name/i), "Acme Retail Ltd");
    await user.click(screen.getByRole("button", { name: /create client/i }));

    await waitFor(() =>
      expect(screen.getByText(/copy this client secret now/i)).toBeInTheDocument(),
    );

    const secretValue = screen.getByTestId("client-secret-value");
    expect(secretValue.textContent).toMatch(/^secret_/);

    // The create form itself is gone — the secret-once panel replaced it, so there is no
    // second place on this page the secret could be re-displayed from.
    expect(screen.queryByLabelText(/client name/i)).not.toBeInTheDocument();
  });

  it("shows a validation error and does not submit when the name is blank", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientNewPage />, { route: "/clients/new" });

    await user.click(screen.getByRole("button", { name: /create client/i }));

    expect(await screen.findByText(/client name is required/i)).toBeInTheDocument();
    expect(screen.queryByText(/copy this client secret now/i)).not.toBeInTheDocument();
  });
});
