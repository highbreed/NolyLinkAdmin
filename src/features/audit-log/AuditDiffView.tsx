/**
 * Renders a before/after audit payload as a readable key-by-key comparison, not a raw JSON
 * dump — each changed key gets its own row with the old and new value side by side.
 */
export function AuditDiffView({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])).sort();

  if (keys.length === 0) {
    return <p className="text-sm text-muted-foreground">No before/after state recorded.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1 pr-4 font-medium">Field</th>
          <th className="py-1 pr-4 font-medium">Before</th>
          <th className="py-1 font-medium">After</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => {
          const beforeValue = before?.[key];
          const afterValue = after?.[key];
          const changed = JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
          return (
            <tr key={key} className={changed ? "bg-status-grace/10" : undefined}>
              <td className="py-1 pr-4 font-mono text-xs">{key}</td>
              <td className="py-1 pr-4 font-mono text-xs text-muted-foreground">
                {stringifyCell(beforeValue)}
              </td>
              <td className="py-1 font-mono text-xs">{stringifyCell(afterValue)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function stringifyCell(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
