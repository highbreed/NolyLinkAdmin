import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { BranchNewPage } from "@/features/branches/BranchNewPage";

describe("BranchNewPage — device init validation", () => {
  it("requires branch code, tin, and bhf id before submitting", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchNewPage />, { route: "/branches/new" });

    await user.click(screen.getByRole("button", { name: /initialize device/i }));

    expect(await screen.findByText(/branch code is required/i)).toBeInTheDocument();
    expect(screen.getByText(/tin is required/i)).toBeInTheDocument();
    expect(screen.getByText(/branch id is required/i)).toBeInTheDocument();
  });

  it("rejects VSCU with no kra_base_url_override client-side, matching the documented 422", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchNewPage />, { route: "/branches/new" });

    await user.type(screen.getByLabelText(/branch code/i), "TEST-VSCU");
    await user.type(screen.getByLabelText(/^tin$/i), "A999999999Z");
    await user.type(screen.getByLabelText(/bhf id/i), "01");
    await user.selectOptions(screen.getByLabelText(/device type/i), "VSCU");
    await user.click(screen.getByRole("button", { name: /initialize device/i }));

    expect(
      await screen.findByText(/VSCU devices require a KRA base URL override/i),
    ).toBeInTheDocument();
  });
});
