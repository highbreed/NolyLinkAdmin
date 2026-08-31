import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/ui/StatusBadge";

describe("StatusBadge", () => {
  it("pairs every status with both a text label and an icon (never color alone)", () => {
    const statuses = ["ACTIVE", "GRACE", "BLOCKED", "SUSPENDED", "CANCELLED", "NO_SUBSCRIPTION", "PENDING", "FAILED"] as const;
    for (const status of statuses) {
      const { container, unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(/./)).toBeInTheDocument();
      expect(container.querySelector("svg")).toBeInTheDocument();
      unmount();
    }
  });

  it("renders distinct text for BLOCKED and SUSPENDED even though both are visually 'red'", () => {
    const { unmount: unmount1, getByText: getByText1 } = render(<StatusBadge status="BLOCKED" />);
    expect(getByText1("Blocked")).toBeInTheDocument();
    unmount1();
    const { getByText: getByText2 } = render(<StatusBadge status="SUSPENDED" />);
    expect(getByText2("Suspended")).toBeInTheDocument();
  });
});
