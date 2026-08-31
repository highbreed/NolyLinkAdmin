import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useNavigate } from "react-router-dom";
import { useSessionStore } from "@/auth/session-store";
import { apiRequest, ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminRole } from "@/api/types";

const schema = z.object({
  apiKey: z.string().min(1, "Admin API key is required"),
});
type FormValues = z.infer<typeof schema>;

const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: "SUPERADMIN", label: "Superadmin" },
  { value: "OPS", label: "Ops" },
  { value: "BILLING_ADMIN", label: "Billing admin" },
  { value: "AUDITOR", label: "Auditor (read-only)" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useSessionStore((s) => s.setSession);
  const clearSession = useSessionStore((s) => s.clearSession);
  const [serverError, setServerError] = useState<string | null>(null);
  const [role, setRole] = useState<AdminRole>("SUPERADMIN");
  const [checking, setChecking] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setChecking(true);
    // The check request must be sent WITH the typed key attached, and apiRequest() always
    // reads the key from the session store — so the key is set optimistically first, then
    // rolled back if the check fails. (Setting it only after a successful check would mean
    // the check itself goes out with no key at all, silently "passing" any input.)
    setSession(values.apiKey, role);
    try {
      // Verify the key actually works against a real admin-gated route before entering
      // the app, so a wrong key fails fast at login rather than on the first action taken.
      await apiRequest("/v1/billing/subscriptions/__login_check__").catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) return; // key was accepted, just no such client
        throw err;
      });
      const from = (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";
      navigate(from, { replace: true });
    } catch (err) {
      clearSession();
      setServerError(err instanceof ApiError ? err.detail : "Could not reach the gateway.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">OSCU Admin Portal</h1>
          <p className="text-sm text-muted-foreground">
            Internal tooling — sign in with the admin API key.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-2">
            <Label htmlFor="apiKey">Admin API key</Label>
            <Input
              id="apiKey"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.apiKey}
              aria-describedby={errors.apiKey ? "apiKey-error" : undefined}
              {...register("apiKey")}
            />
            {errors.apiKey && (
              <p id="apiKey-error" role="alert" className="text-sm text-destructive">
                {errors.apiKey.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Acting as (demo role — see docs/frontend_README.md)</Label>
            <select
              id="role"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {serverError && (
            <p role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={checking}>
            {checking ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
