import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { server } from "@/mocks/server";
import { LoginPage } from "@/auth/LoginPage";
import { RequireAuth } from "@/auth/RequireAuth";
import { useSessionStore } from "@/auth/session-store";

function renderApp() {
  useSessionStore.setState({ apiKey: null, actingRole: "SUPERADMIN" });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<div>Dashboard page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Login flow", () => {
  it("redirects an unauthenticated session from a protected route to /login", () => {
    renderApp();
    expect(screen.getByText("OSCU Admin Portal")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
  });

  it("logs in with a valid key and reaches the originally requested page", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText(/admin api key/i), "test-admin-key");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText("Dashboard page")).toBeInTheDocument());
  });

  it("shows a server error and stays on /login when the key is rejected", async () => {
    server.use(
      http.get("*/v1/billing/subscriptions/__login_check__", () =>
        HttpResponse.json({ detail: "Admin access required" }, { status: 403 }),
      ),
    );
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText(/admin api key/i), "wrong-key");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/admin access required/i);
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
  });
});
