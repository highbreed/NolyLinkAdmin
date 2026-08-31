import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { SecretOncePanel } from "@/features/clients/SecretOncePanel";
import { useCreateClient } from "@/api/clients";
import { useBranchesList } from "@/api/branches";
import { toast } from "@/components/ui/use-toast";
import type { ClientSecretOnce } from "@/api/types";

const schema = z.object({
  name: z.string().min(1, "Client name is required"),
  allowed_branch_ids: z.array(z.string()).default([]),
});
type FormValues = z.infer<typeof schema>;

export function ClientNewPage() {
  const navigate = useNavigate();
  const createClient = useCreateClient();
  const [created, setCreated] = useState<ClientSecretOnce | null>(null);
  const branchesQuery = useBranchesList({ page: 1, pageSize: 100, sort: null, search: "" });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", allowed_branch_ids: [] },
  });
  const selectedBranches = watch("allowed_branch_ids");

  async function onSubmit(values: FormValues) {
    try {
      const result = await createClient.mutateAsync(values);
      setCreated(result);
    } catch (err) {
      toast({
        title: "Failed to create client",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  if (created) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Client created" />
        <SecretOncePanel clientId={created.client_id} secret={created.client_secret} />
        <Button onClick={() => navigate(`/clients/${created.client_id}`)}>
          I've copied the secret — go to client
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Register client" description="Replaces the old direct-SQL insert." />
      <Card>
        <CardContent className="pt-6">
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="name">Client name</Label>
              <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
              {errors.name && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Allowed branches</Label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                {branchesQuery.data?.items.length ? (
                  branchesQuery.data.items.map((branch) => (
                    <label key={branch.branch_code} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedBranches.includes(branch.branch_code)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...selectedBranches, branch.branch_code]
                            : selectedBranches.filter((id) => id !== branch.branch_code);
                          setValue("allowed_branch_ids", next);
                        }}
                      />
                      {branch.branch_code} <span className="text-muted-foreground">({branch.tin})</span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No branches initialized yet.</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Optional — branches can be attached later from the client's Branches tab.
              </p>
            </div>

            <Button type="submit" disabled={createClient.isPending}>
              {createClient.isPending ? "Creating…" : "Create client"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
