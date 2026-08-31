import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuditDiffView } from "@/features/audit-log/AuditDiffView";

describe("AuditDiffView", () => {
  it("renders a readable before/after row for a suspend action's subscription state", () => {
    render(
      <AuditDiffView
        before={{ status: "ACTIVE", suspended_at: null, suspended_reason: null }}
        after={{ status: "SUSPENDED", suspended_at: "2026-08-28T00:00:00Z", suspended_reason: "Chargeback on invoice INV-002" }}
      />,
    );

    expect(screen.getByText("status")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("SUSPENDED")).toBeInTheDocument();
    expect(screen.getByText("suspended_reason")).toBeInTheDocument();
    expect(screen.getByText("Chargeback on invoice INV-002")).toBeInTheDocument();
  });

  it("does not dump raw JSON — each field gets its own row", () => {
    const { container } = render(
      <AuditDiffView before={{ a: 1 }} after={{ a: 2 }} />,
    );
    expect(container.textContent).not.toContain('{"a":1}');
    expect(screen.getAllByRole("row")).toHaveLength(2); // header + one field row
  });

  it("shows a fallback message when there is no before/after state", () => {
    render(<AuditDiffView before={null} after={null} />);
    expect(screen.getByText(/no before\/after state recorded/i)).toBeInTheDocument();
  });
});
