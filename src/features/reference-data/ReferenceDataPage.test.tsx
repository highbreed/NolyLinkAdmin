import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { ReferenceDataPage } from "@/features/reference-data/ReferenceDataPage";

describe("ReferenceDataPage", () => {
  it("browses codes for a classification and switches between classifications", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReferenceDataPage />);

    await waitFor(() => expect(screen.getByText("B-VAT 16%")).toBeInTheDocument());
    expect(screen.getByText("A-Exempt")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /packaging-unit/i }));
    await waitFor(() => expect(screen.getByText("Net")).toBeInTheDocument());
    expect(screen.queryByText("A-Exempt")).not.toBeInTheDocument();
  });

  it("browses item classifications and filters by level", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReferenceDataPage />);

    await user.click(screen.getByRole("tab", { name: /item classifications/i }));
    await waitFor(() => expect(screen.getByText("Bread and bakery products")).toBeInTheDocument());
    expect(screen.getByText("Food and Beverage Products")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/filter by level/i), "1");
    await waitFor(() => expect(screen.queryByText("Bread and bakery products")).not.toBeInTheDocument());
    expect(screen.getByText("Food and Beverage Products")).toBeInTheDocument();
  });
});
