import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInitializeDevice } from "@/api/branches";
import { ApiError } from "@/api/client";
import { toast } from "@/components/ui/use-toast";

const schema = z
  .object({
    branch_code: z.string().min(1, "Branch code is required"),
    tin: z.string().min(1, "TIN is required").max(11, "TIN must be at most 11 characters"),
    bhf_id: z.string().min(1, "Branch id is required").max(2, "BHF ID must be at most 2 characters"),
    device_type: z.enum(["OSCU", "VSCU"]),
    kra_base_url_override: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  })
  .refine((data) => data.device_type !== "VSCU" || !!data.kra_base_url_override, {
    message: "VSCU devices require a KRA base URL override unless a global VSCU host is configured.",
    path: ["kra_base_url_override"],
  });
type FormValues = z.infer<typeof schema>;

export function BranchNewPage() {
  const navigate = useNavigate();
  const initDevice = useInitializeDevice();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { branch_code: "", tin: "", bhf_id: "", device_type: "OSCU", kra_base_url_override: "" },
  });
  const deviceType = watch("device_type");

  async function onSubmit(values: FormValues) {
    try {
      const branch = await initDevice.mutateAsync({
        ...values,
        kra_base_url_override: values.kra_base_url_override || null,
      });
      toast({ title: "Device initialized", description: branch.branch_code });
      navigate(`/branches/${branch.branch_code}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError("kra_base_url_override", { message: err.detail });
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        toast({
          title: "Already installed on KRA with no local record",
          description: "Escalate to ops manually — the old cmcKey can't be recovered from KRA.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Failed to initialize device",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Initialize device" description="One-time per (tin, bhfId). Wraps POST /v1/devices/initialize." />
      <Card>
        <CardContent className="space-y-5 pt-6">
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="branch_code">Branch code</Label>
              <Input id="branch_code" aria-invalid={!!errors.branch_code} {...register("branch_code")} />
              {errors.branch_code && <p role="alert" className="text-sm text-destructive">{errors.branch_code.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tin">TIN</Label>
                <Input id="tin" maxLength={11} aria-invalid={!!errors.tin} {...register("tin")} />
                {errors.tin && <p role="alert" className="text-sm text-destructive">{errors.tin.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="bhf_id">BHF ID</Label>
                <Input id="bhf_id" maxLength={2} aria-invalid={!!errors.bhf_id} {...register("bhf_id")} />
                {errors.bhf_id && <p role="alert" className="text-sm text-destructive">{errors.bhf_id.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="device_type">Device type</Label>
              <select
                id="device_type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                {...register("device_type")}
              >
                <option value="OSCU">OSCU</option>
                <option value="VSCU">VSCU</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kra_base_url_override">
                KRA base URL override{deviceType === "VSCU" ? " (required for VSCU unless globally configured)" : " (optional)"}
              </Label>
              <Input
                id="kra_base_url_override"
                placeholder="https://vscu.example.kra.go.ke"
                aria-invalid={!!errors.kra_base_url_override}
                {...register("kra_base_url_override")}
              />
              {errors.kra_base_url_override && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.kra_base_url_override.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={initDevice.isPending}>
              {initDevice.isPending ? "Initializing…" : "Initialize device"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
