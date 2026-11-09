import { useState } from "react";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SecretOncePanel } from "@/features/customers/SecretOncePanel";
import {
  useConnectors,
  useCreateConnector,
  useRevokeConnector,
  useRotateConnector,
} from "@/api/customers";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/components/ui/use-toast";
import type { Connector, ConnectorSecretOnce } from "@/api/types";

const schema = z.object({ name: z.string().min(1, "Connector name is required") });
type FormValues = z.infer<typeof schema>;

/**
 * One OAuth2 connector credential per integration a customer runs (their prod SAP instance,
 * a staging environment, a POS vendor's middleware, ...) — a customer can have several.
 * Rotate/revoke real, confirmed against the live backend 2026-11-09 (POST .../rotate and
 * .../revoke) — revoke is a soft-deactivate (Client.revoked_at), not a hard delete: a revoked
 * connector's fiscal/idempotency history stays intact, it just can't mint new OAuth2 tokens.
 */
export function ConnectorsTab({ customerId }: { customerId: string }) {
  const connectorsQuery = useConnectors(customerId);
  const createConnector = useCreateConnector(customerId);
  const rotateConnector = useRotateConnector(customerId);
  const revokeConnector = useRevokeConnector(customerId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [created, setCreated] = useState<ConnectorSecretOnce | null>(null);
  const [actionTarget, setActionTarget] = useState<{
    connector: Connector;
    action: "rotate" | "revoke";
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "" } });

  function handleActionError(err: unknown, verb: string) {
    toast({
      title: `Failed to ${verb} connector`,
      description: err instanceof Error ? err.message : "Unknown error",
      variant: "destructive",
    });
  }

  return (
    <div className="space-y-4">
      {created && (
        <div>
          <SecretOncePanel connectorId={created.client_id} secret={created.client_secret} />
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Connectors ({connectorsQuery.data?.length ?? 0})</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setCreated(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New connector
          </Button>
        </CardHeader>
        <CardContent>
          {connectorsQuery.data?.length ? (
            <ul className="space-y-2 text-sm">
              {connectorsQuery.data.map((connector) => {
                const isRevoked = !!connector.revoked_at;
                return (
                  <li
                    key={connector.client_id}
                    className="flex items-center justify-between border-b pb-2 last:border-0"
                  >
                    <div>
                      <p className="font-medium">
                        {connector.name}
                        {isRevoked && (
                          <span className="ml-2 text-xs font-normal text-destructive">
                            Revoked {formatDateTime(connector.revoked_at)}
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{connector.client_id}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{formatDateTime(connector.created_at)}</span>
                      {!isRevoked && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActionTarget({ connector, action: "rotate" })}
                          >
                            Rotate secret
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setActionTarget({ connector, action: "revoke" })}
                          >
                            Revoke access
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No connectors yet — this customer can't integrate until at least one exists.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New connector</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) =>
              createConnector.mutate(values.name, {
                onSuccess: (result) => {
                  setCreated(result);
                  setDialogOpen(false);
                  reset();
                },
                onError: (err) => handleActionError(err, "create"),
              }),
            )}
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="connector-name">Name</Label>
              <Input id="connector-name" placeholder="e.g. Production SAP" aria-invalid={!!errors.name} {...register("name")} />
              {errors.name && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createConnector.isPending}>
                {createConnector.isPending ? "Creating…" : "Create connector"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={actionTarget?.action === "rotate"}
        onOpenChange={(open) => !open && setActionTarget(null)}
        title={`Rotate secret for "${actionTarget?.connector.name}"?`}
        description="Issues a brand-new client_secret for this same connector. Every token already
          issued under the old secret keeps working until it naturally expires; new logins need
          the new secret immediately."
        confirmLabel="Rotate secret"
        isPending={rotateConnector.isPending}
        onConfirm={() => {
          if (!actionTarget) return;
          rotateConnector.mutate(actionTarget.connector.client_id, {
            onSuccess: (result) => {
              setCreated(result);
              setActionTarget(null);
            },
            onError: (err) => handleActionError(err, "rotate"),
          });
        }}
      />

      <ConfirmDialog
        open={actionTarget?.action === "revoke"}
        onOpenChange={(open) => !open && setActionTarget(null)}
        title={`Revoke access for "${actionTarget?.connector.name}"?`}
        description="Its OAuth2 tokens stop working immediately. This connector's fiscal/idempotency
          history is kept, not deleted — there's no undo from here; integrating again means
          creating a new connector."
        confirmPhrase="REVOKE ACCESS"
        variant="destructive"
        confirmLabel="Revoke access"
        isPending={revokeConnector.isPending}
        onConfirm={() => {
          if (!actionTarget) return;
          revokeConnector.mutate(actionTarget.connector.client_id, {
            onSuccess: () => {
              toast({ title: "Connector access revoked." });
              setActionTarget(null);
            },
            onError: (err) => handleActionError(err, "revoke"),
          });
        }}
      />
    </div>
  );
}
