import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { useSessionStore } from "@/auth/session-store";
import { useUiStore } from "@/lib/ui-store";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const actingRole = useSessionStore((s) => s.actingRole);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(actingRole));

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r bg-card transition-all",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div className="flex h-14 items-center justify-between border-b px-3">
        {!collapsed && <span className="truncate text-sm font-semibold">OSCU Admin</span>}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded-md p-1.5 hover:bg-accent"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Primary">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
