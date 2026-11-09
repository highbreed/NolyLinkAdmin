import type { ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";
import { RequireAuth } from "@/auth/RequireAuth";
import { RequireRole } from "@/auth/RequireRole";
import { LoginPage } from "@/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { CustomersListPage } from "@/features/customers/CustomersListPage";
import { CustomerNewPage } from "@/features/customers/CustomerNewPage";
import { CustomerDetailPage } from "@/features/customers/CustomerDetailPage";
import { BranchesListPage } from "@/features/branches/BranchesListPage";
import { BranchNewPage } from "@/features/branches/BranchNewPage";
import { BranchDetailPage } from "@/features/branches/BranchDetailPage";
import { BillingOverviewPage } from "@/features/billing/BillingOverviewPage";
import { InvoiceDetailPage } from "@/features/billing/InvoiceDetailPage";
import { MonitoringPage } from "@/features/monitoring/MonitoringPage";
import { OutboxDetailPage } from "@/features/monitoring/OutboxDetailPage";
import { AlertRulesPage } from "@/features/alert-rules/AlertRulesPage";
import { ReferenceDataPage } from "@/features/reference-data/ReferenceDataPage";
import { AuditLogPage } from "@/features/audit-log/AuditLogPage";
import { ClientCallsPage } from "@/features/client-calls/ClientCallsPage";
import { AdminUsersPage } from "@/features/admin-users/AdminUsersPage";

function wrap(element: ReactNode) {
  return <RouteErrorBoundary>{element}</RouteErrorBoundary>;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "dashboard", element: wrap(<DashboardPage />) },
          { path: "customers", element: wrap(<CustomersListPage />) },
          { path: "customers/new", element: wrap(<CustomerNewPage />) },
          { path: "customers/:id", element: wrap(<CustomerDetailPage />) },
          { path: "branches", element: wrap(<BranchesListPage />) },
          { path: "branches/new", element: wrap(<BranchNewPage />) },
          { path: "branches/:branchCode", element: wrap(<BranchDetailPage />) },
          { path: "reference-data", element: wrap(<ReferenceDataPage />) },
          { path: "billing", element: wrap(<BillingOverviewPage />) },
          { path: "billing/invoices/:id", element: wrap(<InvoiceDetailPage />) },
          { path: "monitoring", element: wrap(<MonitoringPage />) },
          { path: "monitoring/outbox/:id", element: wrap(<OutboxDetailPage />) },
          { path: "alert-rules", element: wrap(<AlertRulesPage />) },
          { path: "audit-log", element: wrap(<AuditLogPage />) },
          { path: "client-calls", element: wrap(<ClientCallsPage />) },
          {
            element: <RequireRole roles={["SUPERADMIN"]} />,
            children: [{ path: "admin-users", element: wrap(<AdminUsersPage />) }],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
]);
