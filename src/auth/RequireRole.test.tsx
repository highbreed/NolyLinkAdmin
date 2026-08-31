import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RequireRole } from "@/auth/RequireRole";
import { useSessionStore } from "@/auth/session-store";

function renderAt(path: string, role: "SUPERADMIN" | "OPS" | "BILLING_ADMIN" | "AUDITOR") {
  useSessionStore.setState({ apiKey: "test-key", actingRole: role });
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
          <Route element={<RequireRole roles={["SUPERADMIN"]} />}>
            <Route path="/admin-users" element={<div>Admin users page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RequireRole — /admin-users is Superadmin-only", () => {
  it("renders the admin-users page for a Superadmin session", () => {
    renderAt("/admin-users", "SUPERADMIN");
    expect(screen.getByText("Admin users page")).toBeInTheDocument();
  });

  it("redirects a non-Superadmin session away from /admin-users by URL, not just hiding the nav link", () => {
    renderAt("/admin-users", "OPS");
    expect(screen.queryByText("Admin users page")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
  });

  it("redirects an Auditor session away from /admin-users too", () => {
    renderAt("/admin-users", "AUDITOR");
    expect(screen.queryByText("Admin users page")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
  });
});
