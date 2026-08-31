import { useState } from "react";
import { Check, Copy, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The dedicated "shown exactly once" UI state for a freshly generated `client_secret` — used
 * both at client creation and at secret rotation (same component, not duplicated). This is a
 * distinct, hard-to-miss panel, not a toast: losing this value means a full rotation flow.
 */
export function SecretOncePanel({ clientId, secret }: { clientId: string; secret: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      role="alert"
      className="space-y-4 rounded-lg border-2 border-status-blocked bg-status-blocked/5 p-6"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-status-blocked" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">Copy this client secret now — it will not be shown again</h2>
          <p className="text-sm text-muted-foreground">
            This is the only time the raw secret is retrievable. If it's lost, the only recovery
            path is rotating it again (which invalidates this one).
          </p>
        </div>
      </div>

      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Client ID</dt>
          <dd className="font-mono">{clientId}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Client secret</dt>
          <dd className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 font-mono text-sm" data-testid="client-secret-value">
              {secret}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </dd>
        </div>
      </dl>
    </div>
  );
}
