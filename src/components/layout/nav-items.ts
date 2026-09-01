import type { AdminRole } from "@/api/types";
import {
  LayoutDashboard,
  Users,
  Router,
  CreditCard,
  Activity,
  BellRing,
  ScrollText,
  ShieldCheck,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  /** Roles allowed to see this item — mirrors admin_portal_design.md §2. */
  roles: AdminRole[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: LayoutDashboard,
    roles: ["SUPERADMIN", "OPS", "BILLING_ADMIN", "AUDITOR"],
  },
  {
    label: "Customers",
    to: "/customers",
    icon: Users,
    roles: ["SUPERADMIN", "OPS", "BILLING_ADMIN", "AUDITOR"],
  },
  {
    label: "Branches",
    to: "/branches",
    icon: Router,
    roles: ["SUPERADMIN", "OPS", "AUDITOR"],
  },
  {
    label: "Billing",
    to: "/billing",
    icon: CreditCard,
    roles: ["SUPERADMIN", "BILLING_ADMIN", "AUDITOR"],
  },
  {
    label: "Monitoring",
    to: "/monitoring",
    icon: Activity,
    roles: ["SUPERADMIN", "OPS", "AUDITOR"],
  },
  {
    label: "Alert rules",
    to: "/alert-rules",
    icon: BellRing,
    roles: ["SUPERADMIN", "OPS"],
  },
  {
    label: "Audit log",
    to: "/audit-log",
    icon: ScrollText,
    roles: ["SUPERADMIN", "OPS", "BILLING_ADMIN", "AUDITOR"],
  },
  {
    label: "Admin users",
    to: "/admin-users",
    icon: ShieldCheck,
    roles: ["SUPERADMIN"],
  },
];
