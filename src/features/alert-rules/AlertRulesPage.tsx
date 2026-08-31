import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertRuleForm } from "@/features/alert-rules/AlertRuleForm";
import { useAlertRules, useCreateAlertRule, useNotificationsList, useUpdateAlertRule } from "@/api/alerts";
import { toast } from "@/components/ui/use-toast";
import { formatDateTime } from "@/lib/format";
import type { AlertRule } from "@/api/types";

export function AlertRulesPage() {
  const rulesQuery = useAlertRules();
  const notificationsQuery = useNotificationsList();
  const createRule = useCreateAlertRule();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alert rules"
        description="Proactive notifications for sync lag, outbox failures, and subscription expirations."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> New rule
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {rulesQuery.data?.length ? (
            <ul className="space-y-2 text-sm">
              {rulesQuery.data.map((rule) => (
                <RuleRow key={rule.id} rule={rule} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No alert rules configured yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification history</CardTitle>
        </CardHeader>
        <CardContent>
          {notificationsQuery.data?.items.length ? (
            <ul className="space-y-2 text-sm">
              {notificationsQuery.data.items.map((n) => (
                <li key={n.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">{n.alert_rule_name}</p>
                    <p className="text-muted-foreground">{n.summary}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={n.resolved_at ? "RESOLVED" : "FIRING"} />
                    <span className="text-muted-foreground">{formatDateTime(n.fired_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No alerts fired yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New alert rule</DialogTitle>
          </DialogHeader>
          <AlertRuleForm
            isPending={createRule.isPending}
            onSubmit={(values) =>
              createRule.mutate(values, {
                onSuccess: () => {
                  toast({ title: "Alert rule created." });
                  setDialogOpen(false);
                },
              })
            }
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RuleRow({ rule }: { rule: AlertRule }) {
  const updateRule = useUpdateAlertRule(rule.id);
  return (
    <li className="flex items-center justify-between border-b pb-2 last:border-0">
      <div>
        <p className="font-medium">{rule.name}</p>
        <p className="text-muted-foreground">
          {rule.metric} {rule.condition} {rule.threshold} → {rule.channel} ({rule.channel_target})
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={updateRule.isPending}
        onClick={() =>
          updateRule.mutate(
            { enabled: !rule.enabled },
            { onSuccess: () => toast({ title: rule.enabled ? "Rule disabled." : "Rule enabled." }) },
          )
        }
      >
        {rule.enabled ? "Disable" : "Enable"}
      </Button>
    </li>
  );
}
