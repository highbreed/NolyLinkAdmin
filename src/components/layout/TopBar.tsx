import { useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { useSessionStore } from "@/auth/session-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "Superadmin",
  OPS: "Ops",
  BILLING_ADMIN: "Billing admin",
  AUDITOR: "Auditor",
};

export function TopBar() {
  const username = useSessionStore((s) => s.username);
  const actingRole = useSessionStore((s) => s.actingRole);
  const clearSession = useSessionStore((s) => s.clearSession);
  const navigate = useNavigate();

  function handleLogout() {
    clearSession();
    toast({ title: "Signed out", description: "Your session has been cleared." });
    navigate("/login", { replace: true });
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <User className="h-4 w-4" />
            {username ?? "Account"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            Signed in as {username} — acting as {ROLE_LABELS[actingRole] ?? actingRole}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
