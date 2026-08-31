import type { ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";
import { RequireAuth } from "@/auth/RequireAuth";
import { RequireRole } from "@/auth/RequireRole";
import { LoginPage } from "@/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ClientsListPage } from "@/features/clients/ClientsListPage";
import { ClientNewPage } from "@/features/clients/ClientNewPage";
import { ClientDetailPage } from "@/features/clients/ClientDetailPage";
import { BranchesListPage } from "@/features/branches/BranchesListPage";
import { BranchNewPage } from "@/features/branches/BranchNewPage";
import { BranchDetailPage } from "@/features/branches/BranchDetailPage";
import { BillingOverviewPage } from "@/features/billing/BillingOverviewPage";
import { InvoiceDetailPage } from "@/features/billing/InvoiceDetailPage";
import { MonitoringPage } from "@/features/monitoring/MonitoringPage";
import { OutboxDetailPage } from "@/features/monitoring/OutboxDetailPage";
import { AlertRulesPage } from "@/features/alert-rules/AlertRulesPage";
import { AuditLogPage } from "@/features/audit-log/AuditLogPage";
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
          { path: "clients", element: wrap(<ClientsListPage />) },
          { path: "clients/new", element: wrap(<ClientNewPage />) },
          { path: "clients/:id", element: wrap(<ClientDetailPage />) },
          { path: "branches", element: wrap(<BranchesListPage />) },
          { path: "branches/new", element: wrap(<BranchNewPage />) },
          { path: "branches/:branchCode", element: wrap(<BranchDetailPage />) },
          { path: "billing", element: wrap(<BillingOverviewPage />) },
          { path: "billing/invoices/:id", element: wrap(<InvoiceDetailPage />) },
          { path: "monitoring", element: wrap(<MonitoringPage />) },
          { path: "monitoring/outbox/:id", element: wrap(<OutboxDetailPage />) },
          { path: "alert-rules", element: wrap(<AlertRulesPage />) },
          { path: "audit-log", element: wrap(<AuditLogPage />) },
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
