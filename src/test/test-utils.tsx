import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useSessionStore } from "@/auth/session-store";
import type { AdminRole } from "@/api/types";

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", role = "SUPERADMIN" }: { route?: string; role?: AdminRole } = {},
) {
  useSessionStore.setState({ apiKey: "test-admin-key", actingRole: role });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
