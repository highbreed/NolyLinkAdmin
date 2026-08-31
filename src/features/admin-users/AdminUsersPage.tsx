import { useState } from "react";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  useAdminUsers,
  useCreateAdminUser,
  useResetAdminUserPassword,
  useUpdateAdminUser,
} from "@/api/adminUsers";
import { toast } from "@/components/ui/use-toast";
import { formatDateTime } from "@/lib/format";
import type { AdminRole, AdminUser } from "@/api/types";

const schema = z.object({
  email: z.string().email("Must be a valid email"),
  role: z.enum(["SUPERADMIN", "OPS", "BILLING_ADMIN", "AUDITOR"]),
});
type FormValues = z.infer<typeof schema>;

export function AdminUsersPage() {
  const usersQuery = useAdminUsers();
  const createUser = useCreateAdminUser();
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", role: "OPS" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin users"
        description="Superadmin only — this backend is proposed, not shipped yet (admin_portal_design.md §5.1)."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> New admin
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {usersQuery.data?.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Email</th>
                  <th className="py-2 font-medium">Role</th>
                  <th className="py-2 font-medium">MFA</th>
                  <th className="py-2 font-medium">Last login</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data.map((user) => (
                  <AdminUserRow key={user.id} user={user} />
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No admin users yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create admin user</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) =>
              createUser.mutate(values, {
                onSuccess: () => {
                  toast({ title: "Admin user created." });
                  setDialogOpen(false);
                  reset();
                },
              }),
            )}
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="au-email">Email</Label>
              <Input id="au-email" aria-invalid={!!errors.email} {...register("email")} />
              {errors.email && <p role="alert" className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="au-role">Role</Label>
              <select id="au-role" className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" {...register("role")}>
                <option value="SUPERADMIN">Superadmin</option>
                <option value="OPS">Ops</option>
                <option value="BILLING_ADMIN">Billing admin</option>
                <option value="AUDITOR">Auditor</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminUserRow({ user }: { user: AdminUser }) {
  const updateUser = useUpdateAdminUser(user.id);
  const resetPassword = useResetAdminUserPassword(user.id);

  return (
    <tr className="border-b last:border-0">
      <td className="py-2">{user.email}</td>
      <td className="py-2">
        <select
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          value={user.role}
          onChange={(e) => updateUser.mutate({ role: e.target.value as AdminRole })}
          aria-label={`Role for ${user.email}`}
        >
          <option value="SUPERADMIN">Superadmin</option>
          <option value="OPS">Ops</option>
          <option value="BILLING_ADMIN">Billing admin</option>
          <option value="AUDITOR">Auditor</option>
        </select>
      </td>
      <td className="py-2">{user.mfa_enabled ? "Enabled" : "Not enrolled"}</td>
      <td className="py-2">{formatDateTime(user.last_login_at)}</td>
      <td className="py-2">
        <StatusBadge status={user.is_active ? "ACTIVE" : "CANCELLED"} />
      </td>
      <td className="space-x-1 py-2 text-right">
        <Button size="sm" variant="outline" onClick={() => resetPassword.mutate()} disabled={resetPassword.isPending}>
          Force reset
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => updateUser.mutate({ is_active: !user.is_active })}
          disabled={updateUser.isPending}
        >
          {user.is_active ? "Disable" : "Enable"}
        </Button>
      </td>
    </tr>
  );
}
