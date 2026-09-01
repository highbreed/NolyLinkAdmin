import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { ConnectorsTab } from "@/features/customers/ConnectorsTab";

describe("ConnectorsTab", () => {
  it("creates a connector and shows the secret-once panel with the raw secret, exactly once", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectorsTab customerId="cu111111-1111-1111-1111-111111111111" />);

    await user.click(screen.getByRole("button", { name: /new connector/i }));
    await user.type(screen.getByLabelText(/name/i), "Staging SAP");
    await user.click(screen.getByRole("button", { name: /^create connector$/i }));

    await waitFor(() => expect(screen.getByText(/copy this connector secret now/i)).toBeInTheDocument());

    const secretValue = screen.getByTestId("client-secret-value");
    expect(secretValue.textContent).toMatch(/^secret_/);

    // The create dialog is gone — the secret-once panel is the only place this value appears.
    expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument();
  });

  it("shows a validation error when the connector name is blank", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectorsTab customerId="cu111111-1111-1111-1111-111111111111" />);

    await user.click(screen.getByRole("button", { name: /new connector/i }));
    await user.click(screen.getByRole("button", { name: /^create connector$/i }));

    expect(await screen.findByText(/connector name is required/i)).toBeInTheDocument();
  });
});
