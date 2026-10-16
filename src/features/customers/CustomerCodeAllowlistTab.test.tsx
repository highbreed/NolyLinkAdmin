import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { CustomerCodeAllowlistTab } from "@/features/customers/CustomerCodeAllowlistTab";

const CUSTOMER_WITH_RESTRICTION = "cu111111-1111-1111-1111-111111111111"; // fixture: tax-type -> ["B"]
const CUSTOMER_UNRESTRICTED = "cu222222-2222-2222-2222-222222222222";

function rowFor(classification: string) {
  return screen.getByText(classification).closest("tr")!;
}

describe("CustomerCodeAllowlistTab", () => {
  it("shows the existing restriction and leaves other classifications unrestricted", async () => {
    renderWithProviders(<CustomerCodeAllowlistTab customerId={CUSTOMER_WITH_RESTRICTION} />);

    await waitFor(() => expect(screen.getByText("tax-type")).toBeInTheDocument());
    expect(within(rowFor("tax-type")).getByText("1 code allowed")).toBeInTheDocument();
    expect(within(rowFor("packaging-unit")).getByText("Unrestricted")).toBeInTheDocument();
  });

  it("assigns then clears a restriction", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomerCodeAllowlistTab customerId={CUSTOMER_UNRESTRICTED} />);

    await waitFor(() => expect(screen.getByText("tax-type")).toBeInTheDocument());
    expect(within(rowFor("tax-type")).getByText("Unrestricted")).toBeInTheDocument();

    await user.click(within(rowFor("tax-type")).getByRole("button", { name: /manage/i }));
    await waitFor(() => expect(screen.getByText(/B — B-VAT 16%/)).toBeInTheDocument());
    await user.click(screen.getByRole("checkbox", { name: /B — B-VAT 16%/ }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(within(rowFor("tax-type")).getByText("1 code allowed")).toBeInTheDocument());

    await user.click(within(rowFor("tax-type")).getByRole("button", { name: /manage/i }));
    await user.click(await screen.findByRole("button", { name: /clear restriction/i }));

    await waitFor(() => expect(within(rowFor("tax-type")).getByText("Unrestricted")).toBeInTheDocument());
  });
});
