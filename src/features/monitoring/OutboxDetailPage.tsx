import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useOutboxItem, useRetryOutboxItem, useCancelOutboxItem } from "@/api/monitoring";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/components/ui/use-toast";

export function OutboxDetailPage() {
  const { id } = useParams<{ id: string }>();
  const itemQuery = useOutboxItem(id);
  const retry = useRetryOutboxItem();
  const cancel = useCancelOutboxItem();
  const [cancelOpen, setCancelOpen] = useState(false);

  if (itemQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (itemQuery.isError || !itemQuery.data) return <p className="text-sm text-destructive">Outbox item not found.</p>;

  const item = itemQuery.data;

  return (
    <div className="max-w-xl space-y-4">
      <PageHeader title={item.endpoint} description={`Outbox item ${item.id}`} actions={<StatusBadge status={item.status} />} />

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-muted-foreground">Branch</dt>
              <dd>{item.branch_code ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Client</dt>
              <dd>
                {item.client_id ? (
                  <Link to={`/clients/${item.client_id}`} className="text-primary hover:underline">
                    {item.client_name ?? item.client_id}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Attempts</dt>
              <dd>{item.attempts}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated</dt>
              <dd>{formatDateTime(item.updated_at)}</dd>
            </div>
          </dl>
          {item.last_error && (
            <div>
              <dt className="text-muted-foreground">Last error</dt>
              <dd className="font-mono text-xs">{item.last_error}</dd>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {(item.status === "FAILED" || item.status === "RETRYING") && (
              <Button
                disabled={retry.isPending}
                onClick={() =>
                  retry.mutate(item.id, { onSuccess: () => toast({ title: "Re-enqueued for retry." }) })
                }
              >
                Retry
              </Button>
            )}
            {item.status !== "CANCELLED" && item.status !== "SENT" && (
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this outbox item?"
        description="Stops the dispatcher from retrying it permanently."
        confirmLabel="Cancel item"
        variant="destructive"
        isPending={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(item.id, {
            onSuccess: () => {
              toast({ title: "Outbox item cancelled." });
              setCancelOpen(false);
            },
          })
        }
      />
    </div>
  );
}
