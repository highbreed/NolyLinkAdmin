import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useOnboardCustomer } from "@/api/customers";
import { toast } from "@/components/ui/use-toast";
import type { CustomerOnboardResponse } from "@/api/types";

const branchSchema = z
  .object({
    branch_code: z.string().min(1, "Branch code is required"),
    tin: z.string().min(1, "TIN is required").max(11, "TIN must be at most 11 characters"),
    bhf_id: z.string().min(1, "Branch id is required").max(2, "BHF ID must be at most 2 characters"),
    device_type: z.enum(["OSCU", "VSCU"]),
    base_url: z.string().optional(),
    kra_base_url_override: z.string().optional(),
  })
  .refine((data) => data.device_type !== "VSCU" || !!data.base_url, {
    message: "base_url is required for VSCU branches (the customer's own local VSCU app URL)",
    path: ["base_url"],
  });

const schema = z.object({
  name: z.string().min(1, "Customer name is required"),
  branches: z.array(branchSchema),
});
type FormValues = z.infer<typeof schema>;

const emptyBranch: FormValues["branches"][number] = {
  branch_code: "",
  tin: "",
  bhf_id: "",
  device_type: "OSCU",
  base_url: "",
  kra_base_url_override: "",
};

/**
 * One-call onboarding, per the real POST /v1/customers/onboard: registers every branch (KRA
 * device-init, plus VSCU app init for VSCU ones) and creates the Customer with whichever
 * branches succeeded. Best-effort per branch, not atomic — a partial failure still creates the
 * customer with the branches that did register; failed ones need to be fixed and registered
 * individually via /branches/new, then attached from the customer's Branches tab (there's no
 * "resubmit only the failed ones into this same customer" — onboarding always creates a new
 * customer, so retrying this form again would create a second one).
 */
export function CustomerNewPage() {
  const navigate = useNavigate();
  const onboard = useOnboardCustomer();
  const [result, setResult] = useState<CustomerOnboardResponse | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", branches: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "branches" });

  async function onSubmit(values: FormValues) {
    try {
      const response = await onboard.mutateAsync({
        name: values.name,
        branches: values.branches.map((b) => ({
          ...b,
          base_url: b.device_type === "VSCU" ? b.base_url || null : null,
          kra_base_url_override: b.kra_base_url_override || null,
        })),
      });
      setResult(response);
    } catch (err) {
      toast({
        title: "Failed to onboard customer",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  if (result) {
    const failedCount = result.branches.filter((b) => b.status === "FAILED").length;
    return (
      <div className="max-w-2xl space-y-4">
        <PageHeader title="Customer onboarded" description={result.customer.name} />

        <Card>
          <CardHeader>
            <CardTitle>Branch registration results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.branches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No branches were submitted.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {result.branches.map((b) => (
                  <li key={b.branch_code} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">
                        {b.branch_code} <span className="text-muted-foreground">({b.device_type})</span>
                      </p>
                      {b.error && <p className="text-xs text-destructive">{b.error}</p>}
                    </div>
                    <StatusBadge status={b.status} />
                  </li>
                ))}
              </ul>
            )}
            {failedCount > 0 && (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                {failedCount} branch{failedCount > 1 ? "es" : ""} failed to register. Fix the
                issue and register {failedCount > 1 ? "them" : "it"} individually from{" "}
                <button className="text-primary hover:underline" onClick={() => navigate("/branches/new")}>
                  Initialize device
                </button>
                , then attach {failedCount > 1 ? "them" : "it"} from this customer's Branches
                tab — resubmitting this form again would create a second customer, not add to
                this one.
              </p>
            )}
          </CardContent>
        </Card>

        <Button onClick={() => navigate(`/customers/${result.customer.id}?tab=connectors`)}>
          Continue to connectors
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Onboard customer"
        description="Registers each branch's device with KRA and creates the customer in one step."
      />
      <Card>
        <CardContent className="space-y-6 pt-6">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="name">Customer name</Label>
              <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
              {errors.name && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Branches to register</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => append(emptyBranch)}>
                  <Plus className="h-4 w-4" /> Add branch
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No branches added yet — a customer can also be onboarded with zero branches
                  and have them attached later.
                </p>
              )}

              {fields.map((field, index) => {
                const deviceType = watch(`branches.${index}.device_type`);
                const branchErrors = errors.branches?.[index];
                return (
                  <div key={field.id} className="space-y-3 rounded-md border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="space-y-1">
                          <Label htmlFor={`branch_code-${index}`}>Branch code</Label>
                          <Input
                            id={`branch_code-${index}`}
                            aria-invalid={!!branchErrors?.branch_code}
                            {...register(`branches.${index}.branch_code`)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`tin-${index}`}>TIN</Label>
                          <Input
                            id={`tin-${index}`}
                            maxLength={11}
                            aria-invalid={!!branchErrors?.tin}
                            {...register(`branches.${index}.tin`)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`bhf_id-${index}`}>BHF ID</Label>
                          <Input
                            id={`bhf_id-${index}`}
                            maxLength={2}
                            aria-invalid={!!branchErrors?.bhf_id}
                            {...register(`branches.${index}.bhf_id`)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`device_type-${index}`}>Device type</Label>
                          <select
                            id={`device_type-${index}`}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                            {...register(`branches.${index}.device_type`)}
                          >
                            <option value="OSCU">OSCU</option>
                            <option value="VSCU">VSCU</option>
                          </select>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove branch ${index + 1}`}
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {deviceType === "VSCU" && (
                      <div className="space-y-1">
                        <Label htmlFor={`base_url-${index}`}>VSCU app base URL (required)</Label>
                        <Input
                          id={`base_url-${index}`}
                          placeholder="http://192.168.1.10:8088"
                          aria-invalid={!!branchErrors?.base_url}
                          {...register(`branches.${index}.base_url`)}
                        />
                        {branchErrors?.base_url && (
                          <p role="alert" className="text-sm text-destructive">
                            {branchErrors.base_url.message}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label htmlFor={`kra_base_url_override-${index}`}>KRA base URL override (optional)</Label>
                      <Input
                        id={`kra_base_url_override-${index}`}
                        placeholder="Leave blank to use the default host"
                        {...register(`branches.${index}.kra_base_url_override`)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <Button type="submit" disabled={onboard.isPending}>
              {onboard.isPending ? "Onboarding…" : "Onboard customer"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
