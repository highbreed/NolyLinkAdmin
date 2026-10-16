import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCustomerCodeAllowlist, useSetCustomerCodeAllowlist } from "@/api/customers";
import { useItemClasses, useReferenceCodes, useReferenceDataIndex } from "@/api/referenceData";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";

const ITEM_CLASSIFICATION_SLUG = "item-classification";

/** Classifications large/hierarchical enough to warrant the wider dialog + a level filter. */
const WIDE_CLASSIFICATIONS = new Set([ITEM_CLASSIFICATION_SLUG, "nation"]);

/** Rendering every row of a ~1000-item list as a checkbox is wasteful before the admin narrows it down. */
const RENDER_CAP = 300;

/**
 * A classification with no allow-list row is unrestricted (any cached code accepted) — not
 * "no codes allowed". See kra_vscu_backend/docs/reference_data_and_code_assignment.md §4.
 */
export function CustomerCodeAllowlistTab({ customerId }: { customerId: string }) {
  const indexQuery = useReferenceDataIndex();
  const allowlistQuery = useCustomerCodeAllowlist(customerId);
  const [managing, setManaging] = useState<string | null>(null);

  const classifications = useMemo(
    () => [...(indexQuery.data?.map((c) => c.classification) ?? []), ITEM_CLASSIFICATION_SLUG],
    [indexQuery.data],
  );
  const allowlistByClassification = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const entry of allowlistQuery.data ?? []) map.set(entry.classification, entry.codes);
    return map;
  }, [allowlistQuery.data]);

  const isLoading = indexQuery.isLoading || allowlistQuery.isLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Code restrictions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Restricts which KRA reference codes this customer's connectors may submit when registering items or sales.
          Unrestricted by default.
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Classification</TableHead>
                <TableHead>Restriction</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {classifications.map((classification) => {
                const codes = allowlistByClassification.get(classification);
                return (
                  <TableRow key={classification}>
                    <TableCell className="font-medium">{classification}</TableCell>
                    <TableCell>
                      {codes && codes.length > 0 ? (
                        <Badge variant="secondary">
                          {codes.length} code{codes.length === 1 ? "" : "s"} allowed
                        </Badge>
                      ) : (
                        <Badge variant="outline">Unrestricted</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => setManaging(classification)}>
                        <Pencil className="h-3.5 w-3.5" /> Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {managing && (
        <ManageAllowlistDialog
          customerId={customerId}
          classification={managing}
          currentCodes={allowlistByClassification.get(managing) ?? []}
          onClose={() => setManaging(null)}
        />
      )}
    </Card>
  );
}

function ManageAllowlistDialog({
  customerId,
  classification,
  currentCodes,
  onClose,
}: {
  customerId: string;
  classification: string;
  currentCodes: string[];
  onClose: () => void;
}) {
  const isItemClass = classification === ITEM_CLASSIFICATION_SLUG;
  const isWide = WIDE_CLASSIFICATIONS.has(classification);
  const codesQuery = useReferenceCodes(isItemClass ? undefined : classification);
  const itemClassesQuery = useItemClasses();
  const setAllowlist = useSetCustomerCodeAllowlist(customerId);

  const [selected, setSelected] = useState<Set<string>>(new Set(currentCodes));
  const [filter, setFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");

  const isLoading = isItemClass ? itemClassesQuery.isLoading : codesQuery.isLoading;

  const options = useMemo<{ value: string; label: string }[]>(() => {
    if (isItemClass) {
      return (itemClassesQuery.data ?? [])
        .filter((c) => !levelFilter || c.item_cls_lvl === levelFilter)
        .map((c) => ({ value: c.item_cls_cd, label: `${c.item_cls_cd} — ${c.item_cls_nm}` }));
    }
    return (codesQuery.data ?? []).map((c) => ({ value: c.cd, label: `${c.cd} — ${c.cd_nm}` }));
  }, [isItemClass, itemClassesQuery.data, codesQuery.data, levelFilter]);

  const filtered = filter
    ? options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase()))
    : options;
  const isCapped = filtered.length > RENDER_CAP;
  const visible = isCapped ? filtered.slice(0, RENDER_CAP) : filtered;

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => new Set([...prev, ...visible.map((o) => o.value)]));
  }

  function clearAllVisible() {
    const visibleValues = new Set(visible.map((o) => o.value));
    setSelected((prev) => new Set([...prev].filter((v) => !visibleValues.has(v))));
  }

  function save(codes: string[]) {
    setAllowlist.mutate(
      { classification, codes },
      {
        onSuccess: () => {
          toast({ title: `Updated '${classification}' restriction for this customer.` });
          onClose();
        },
        onError: (err) =>
          toast({
            title: "Failed to update restriction",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "flex max-h-[85vh] w-[calc(100vw-2rem)] flex-col overflow-hidden",
          isWide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <DialogHeader>
          <DialogTitle>Manage '{classification}' codes</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-xs"
              placeholder="Filter by code or name…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter codes"
            />
            {isItemClass && (
              <select
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                aria-label="Filter by level"
              >
                <option value="">All levels</option>
                <option value="1">Level 1 — Segment</option>
                <option value="2">Level 2 — Family</option>
                <option value="3">Level 3 — Class</option>
              </select>
            )}
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {filtered.length} of {options.length} shown
              </span>
              <Button type="button" variant="outline" size="sm" onClick={selectAllVisible} disabled={visible.length === 0}>
                Select shown
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearAllVisible} disabled={visible.length === 0}>
                Unselect shown
              </Button>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto rounded-md border p-2">
              {visible.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">No codes match.</p>
              ) : (
                <div className={cn("grid gap-x-4 gap-y-0.5", isWide && "sm:grid-cols-2")}>
                  {visible.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(option.value)}
                        onChange={() => toggle(option.value)}
                      />
                      <span className="truncate">{option.label}</span>
                    </label>
                  ))}
                </div>
              )}
              {isCapped && (
                <p className="mt-2 border-t px-1 pt-2 text-xs text-muted-foreground">
                  Showing the first {RENDER_CAP} of {filtered.length} matches — narrow your search
                  {isItemClass ? " or level" : ""} to see more.
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {selected.size === 0
              ? "Nothing selected — saving will leave this customer unrestricted for this classification."
              : `${selected.size} code${selected.size === 1 ? "" : "s"} selected in total.`}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={setAllowlist.isPending} onClick={() => save([])}>
            Clear restriction
          </Button>
          <Button disabled={setAllowlist.isPending} onClick={() => save([...selected])}>
            {setAllowlist.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
