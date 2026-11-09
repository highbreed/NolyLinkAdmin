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
import { useOnboardCustomer, useUpdateCustomer } from "@/api/customers";
import { useInitializeDevice } from "@/api/branches";
import { toast } from "@/components/ui/use-toast";
import type { CustomerOnboardBranchInput, CustomerOnboardResponse } from "@/api/types";

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
 * customer with the branches that did register. Resubmitting this whole form again would
 * create a SECOND customer (onboarding always creates one), so the result screen's "Retry
 * failed branches" button instead composes the same two real calls a manual fix would use —
 * useInitializeDevice (POST /v1/devices/initialize) then useUpdateCustomer (PATCH .../{id},
 * which useAttachBranch itself just wraps) — sequentially per branch, onto this SAME customer.
 */
export function CustomerNewPage() {
  const navigate = useNavigate();
  const onboard = useOnboardCustomer();
  const [result, setResult] = useState<CustomerOnboardResponse | null>(null);
  const [submittedBranches, setSubmittedBranches] = useState<CustomerOnboardBranchInput[]>([]);
  const [retryResults, setRetryResults] = useState<
    Record<string, { status: "REGISTERED" | "FAILED"; error?: string }>
  >({});
  const [isRetrying, setIsRetrying] = useState(false);
  const initDevice = useInitializeDevice();
  const updateCustomer = useUpdateCustomer(result?.customer.id ?? "");

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
    const branches = values.branches.map((b) => ({
      ...b,
      base_url: b.device_type === "VSCU" ? b.base_url || null : null,
      kra_base_url_override: b.kra_base_url_override || null,
    }));
    try {
      const response = await onboard.mutateAsync({ name: values.name, branches });
      setSubmittedBranches(branches);
      setRetryResults({});
      setResult(response);
    } catch (err) {
      toast({
        title: "Failed to onboard customer",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleRetryFailed() {
    if (!result) return;
    const toRetry = result.branches.filter(
      (b) => b.status === "FAILED" && retryResults[b.branch_code]?.status !== "REGISTERED",
    );
    if (toRetry.length === 0) return;

    setIsRetrying(true);
    let branchCodes = [...result.customer.branch_codes];
    for (const failedBranch of toRetry) {
      const original = submittedBranches.find((b) => b.branch_code === failedBranch.branch_code);
      if (!original) {
        setRetryResults((prev) => ({
          ...prev,
          [failedBranch.branch_code]: {
            status: "FAILED",
            error: "Original branch details no longer available in this session — re-enter it via Initialize device instead.",
          },
        }));
        continue;
      }
      try {
        await initDevice.mutateAsync({
          branch_code: original.branch_code,
          tin: original.tin,
          bhf_id: original.bhf_id,
          device_type: original.device_type,
          // Mirrors BranchNewPage.tsx's own field mapping: kra_base_url_override is OSCU-only
          // server-side (device.py), but VSCU's local app base_url has no dedicated field on
          // this endpoint, so VSCU branches thread it through the same way that form already
          // does, for consistency with the existing (manual) fix-up path this replaces.
          kra_base_url_override:
            original.device_type === "VSCU"
              ? original.base_url || null
              : original.kra_base_url_override || null,
        });
        branchCodes = [...branchCodes, original.branch_code];
        await updateCustomer.mutateAsync({ branch_codes: branchCodes });
        setRetryResults((prev) => ({ ...prev, [failedBranch.branch_code]: { status: "REGISTERED" } }));
      } catch (err) {
        setRetryResults((prev) => ({
          ...prev,
          [failedBranch.branch_code]: {
            status: "FAILED",
            error: err instanceof Error ? err.message : "Unknown error",
          },
        }));
      }
    }
    setIsRetrying(false);
  }

  if (result) {
    const stillFailedCount = result.branches.filter(
      (b) => b.status === "FAILED" && retryResults[b.branch_code]?.status !== "REGISTERED",
    ).length;
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
                {result.branches.map((b) => {
                  const retry = retryResults[b.branch_code];
                  const effectiveStatus = retry?.status ?? b.status;
                  const effectiveError = retry ? retry.error : b.error;
                  return (
                    <li key={b.branch_code} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0">
                      <div>
                        <p className="font-medium">
                          {b.branch_code} <span className="text-muted-foreground">({b.device_type})</span>
                          {retry?.status === "REGISTERED" && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">(retried)</span>
                          )}
                        </p>
                        {effectiveError && <p className="text-xs text-destructive">{effectiveError}</p>}
                      </div>
                      <StatusBadge status={effectiveStatus} />
                    </li>
                  );
                })}
              </ul>
            )}
            {stillFailedCount > 0 && (
              <div className="space-y-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                <p>
                  {stillFailedCount} branch{stillFailedCount > 1 ? "es" : ""} failed to register.
                  Retry {stillFailedCount > 1 ? "them" : "it"} below (registers the device again
                  and attaches it to this same customer), or fix the issue and register{" "}
                  {stillFailedCount > 1 ? "them" : "it"} individually from{" "}
                  <button className="text-primary hover:underline" onClick={() => navigate("/branches/new")}>
                    Initialize device
                  </button>
                  , then attach from this customer's Branches tab instead.
                </p>
                <Button type="button" size="sm" variant="outline" onClick={handleRetryFailed} disabled={isRetrying}>
                  {isRetrying ? "Retrying…" : `Retry failed branch${stillFailedCount > 1 ? "es" : ""}`}
                </Button>
              </div>
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
