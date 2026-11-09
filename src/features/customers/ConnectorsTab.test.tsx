import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
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

  it("rotates a connector's secret and shows it once via the secret-once panel", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectorsTab customerId="cu111111-1111-1111-1111-111111111111" />);

    const row = (await screen.findByText("Production SAP")).closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: /rotate secret/i }));

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Rotate secret" }));

    await waitFor(() => expect(screen.getByText(/copy this connector secret now/i)).toBeInTheDocument());
    expect(screen.getByTestId("client-secret-value").textContent).toMatch(/^secret_/);
  });

  it("revokes a connector after typing the confirm phrase, and hides its actions afterward", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectorsTab customerId="cu111111-1111-1111-1111-111111111111" />);

    const row = (await screen.findByText("Production SAP")).closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: /revoke access/i }));

    const dialog = screen.getByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Revoke access" });
    expect(confirmButton).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/type.*to confirm/i), "REVOKE ACCESS");
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    await waitFor(() => expect(within(row).getByText(/revoked/i)).toBeInTheDocument());
    expect(within(row).queryByRole("button", { name: /rotate secret/i })).not.toBeInTheDocument();
  });
});
