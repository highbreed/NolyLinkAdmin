import { PageHeader } from "@/components/layout/PageHeader";
import { AuditLogTable } from "@/features/audit-log/AuditLogTable";

export function AuditLogPage() {
  return (
    <div>
      <PageHeader title="Audit log" description="Every admin write action, system-wide." />
      <AuditLogTable />
    </div>
  );
}
