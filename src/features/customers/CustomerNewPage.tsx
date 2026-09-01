import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useCreateCustomer } from "@/api/customers";
import { useAllBranches } from "@/api/branches";
import { toast } from "@/components/ui/use-toast";

const schema = z.object({
  name: z.string().min(1, "Customer name is required"),
  branch_codes: z.array(z.string()).default([]),
});
type FormValues = z.infer<typeof schema>;

export function CustomerNewPage() {
  const navigate = useNavigate();
  const createCustomer = useCreateCustomer();
  const branchesQuery = useAllBranches();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", branch_codes: [] },
  });
  const selectedBranches = watch("branch_codes");

  async function onSubmit(values: FormValues) {
    try {
      const customer = await createCustomer.mutateAsync(values);
      toast({ title: "Customer registered", description: customer.name });
      navigate(`/customers/${customer.id}?tab=connectors`);
    } catch (err) {
      toast({
        title: "Failed to register customer",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Register customer"
        description="Replaces the old direct-SQL insert. Create at least one connector next, on the Connectors tab."
      />
      <Card>
        <CardContent className="pt-6">
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="name">Customer name</Label>
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
                {branchesQuery.data?.length ? (
                  branchesQuery.data.map((branch) => (
                    <label key={branch.branch_code} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedBranches.includes(branch.branch_code)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...selectedBranches, branch.branch_code]
                            : selectedBranches.filter((code) => code !== branch.branch_code);
                          setValue("branch_codes", next);
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
                Optional — branches can be attached later from the customer's Branches tab.
              </p>
            </div>

            <Button type="submit" disabled={createCustomer.isPending}>
              {createCustomer.isPending ? "Registering…" : "Register customer"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
