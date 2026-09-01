import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAlertRulePreview } from "@/api/alerts";
import type { AlertRuleInput } from "@/api/types";

const schema = z
  .object({
    name: z.string().min(1, "Name is required"),
    metric: z.enum([
      "sync_lag_seconds",
      "outbox_failed_count",
      "subscription_grace_period_ending",
      "kra_call_failure_rate",
    ]),
    condition: z.enum([">", ">=", "==", "<="]),
    threshold: z.coerce.number(),
    channel: z.enum(["email", "webhook"]),
    channel_target: z.string().min(1, "Required"),
    enabled: z.boolean().default(true),
  })
  .refine(
    (data) =>
      data.channel !== "webhook" || /^https?:\/\/.+/.test(data.channel_target),
    { message: "Webhook target must be a valid URL", path: ["channel_target"] },
  )
  .refine(
    (data) => data.channel !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.channel_target),
    { message: "Email target must be a valid email address", path: ["channel_target"] },
  );
type FormValues = z.infer<typeof schema>;

export function AlertRuleForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (values: AlertRuleInput) => void;
  isPending: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      metric: "sync_lag_seconds",
      condition: ">",
      threshold: 1800,
      channel: "email",
      channel_target: "",
      enabled: true,
    },
  });
  const channel = watch("channel");
  const metric = watch("metric");
  const condition = watch("condition");
  const threshold = watch("threshold");

  const previewQuery = useAlertRulePreview({
    metric,
    condition,
    threshold: Number(threshold) || 0,
    scope_customer_id: null,
    scope_branch_code: null,
  });

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((values) => onSubmit({ ...values, scope_customer_id: null, scope_branch_code: null }))}
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="ar-name">Name</Label>
        <Input id="ar-name" aria-invalid={!!errors.name} {...register("name")} />
        {errors.name && <p role="alert" className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="ar-metric">Metric</Label>
          <select id="ar-metric" className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" {...register("metric")}>
            <option value="sync_lag_seconds">Sync lag (seconds)</option>
            <option value="outbox_failed_count">Outbox failed count</option>
            <option value="subscription_grace_period_ending">Grace period ending (days)</option>
            <option value="kra_call_failure_rate">KRA call failure rate</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ar-condition">Condition</Label>
          <select id="ar-condition" className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" {...register("condition")}>
            <option value=">">&gt;</option>
            <option value=">=">&gt;=</option>
            <option value="<=">&lt;=</option>
            <option value="==">==</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ar-threshold">Threshold</Label>
          <Input id="ar-threshold" type="number" {...register("threshold")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="ar-channel">Channel</Label>
          <select id="ar-channel" className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" {...register("channel")}>
            <option value="email">Email</option>
            <option value="webhook">Webhook</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ar-target">{channel === "webhook" ? "Webhook URL" : "Email address"}</Label>
          <Input id="ar-target" aria-invalid={!!errors.channel_target} {...register("channel_target")} />
          {errors.channel_target && (
            <p role="alert" className="text-sm text-destructive">
              {errors.channel_target.message}
            </p>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" defaultChecked {...register("enabled")} /> Enabled
      </label>

      <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
        This rule would have fired{" "}
        <span className="font-semibold text-foreground">
          {previewQuery.data?.fired_count_last_7_days ?? "…"}
        </span>{" "}
        times in the last 7 days.
      </p>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save rule"}
      </Button>
    </form>
  );
}
