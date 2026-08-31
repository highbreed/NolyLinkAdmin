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
import { useAdminUsers, useCreateAdminUser, useDeactivateAdminUser, useReactivateAdminUser } from "@/api/adminUsers";
import { toast } from "@/components/ui/use-toast";
import { formatDateTime } from "@/lib/format";
import type { AdminUser } from "@/api/types";

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  full_name: z.string().optional(),
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
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { username: "", password: "", full_name: "" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin users"
        description="Superadmin only in this UI — the real backend (POST /admin/users) has no roles of its own yet."
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
                  <th className="py-2 font-medium">Username</th>
                  <th className="py-2 font-medium">Full name</th>
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
              createUser.mutate(
                { username: values.username, password: values.password, full_name: values.full_name || null },
                {
                  onSuccess: () => {
                    toast({ title: "Admin user created." });
                    setDialogOpen(false);
                    reset();
                  },
                  onError: (err) =>
                    toast({
                      title: "Failed to create admin user",
                      description: err instanceof Error ? err.message : "Unknown error",
                      variant: "destructive",
                    }),
                },
              ),
            )}
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="au-username">Username</Label>
              <Input id="au-username" aria-invalid={!!errors.username} {...register("username")} />
              {errors.username && <p role="alert" className="text-sm text-destructive">{errors.username.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="au-password">Password</Label>
              <Input id="au-password" type="password" aria-invalid={!!errors.password} {...register("password")} />
              {errors.password && <p role="alert" className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="au-full-name">Full name (optional)</Label>
              <Input id="au-full-name" {...register("full_name")} />
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
  const deactivate = useDeactivateAdminUser();
  const reactivate = useReactivateAdminUser();
  const isPending = deactivate.isPending || reactivate.isPending;

  return (
    <tr className="border-b last:border-0">
      <td className="py-2">{user.username}</td>
      <td className="py-2">{user.full_name ?? "—"}</td>
      <td className="py-2">{formatDateTime(user.last_login_at)}</td>
      <td className="py-2">
        <StatusBadge status={user.is_active ? "ACTIVE" : "CANCELLED"} />
      </td>
      <td className="py-2 text-right">
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            user.is_active
              ? deactivate.mutate(user.id, { onSuccess: () => toast({ title: `${user.username} deactivated.` }) })
              : reactivate.mutate(user.id, { onSuccess: () => toast({ title: `${user.username} reactivated.` }) })
          }
        >
          {user.is_active ? "Deactivate" : "Reactivate"}
        </Button>
      </td>
    </tr>
  );
}
