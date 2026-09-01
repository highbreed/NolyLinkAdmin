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
import { SecretOncePanel } from "@/features/customers/SecretOncePanel";
import { useConnectors, useCreateConnector } from "@/api/customers";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/components/ui/use-toast";
import type { ConnectorSecretOnce } from "@/api/types";

const schema = z.object({ name: z.string().min(1, "Connector name is required") });
type FormValues = z.infer<typeof schema>;

/**
 * One OAuth2 connector credential per integration a customer runs (their prod SAP instance,
 * a staging environment, a POS vendor's middleware, ...) — a customer can have several. No
 * rotate/delete endpoint exists yet (2026-09-01): a lost secret means creating a new connector.
 */
export function ConnectorsTab({ customerId }: { customerId: string }) {
  const connectorsQuery = useConnectors(customerId);
  const createConnector = useCreateConnector(customerId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [created, setCreated] = useState<ConnectorSecretOnce | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "" } });

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
              {connectorsQuery.data.map((connector) => (
                <li key={connector.client_id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">{connector.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{connector.client_id}</p>
                  </div>
                  <span className="text-muted-foreground">{formatDateTime(connector.created_at)}</span>
                </li>
              ))}
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
                onError: (err) =>
                  toast({
                    title: "Failed to create connector",
                    description: err instanceof Error ? err.message : "Unknown error",
                    variant: "destructive",
                  }),
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
    </div>
  );
}
