import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/DataTable";
import { useDataTableState } from "@/components/data-table/useDataTableState";
import { useItemClassesTable, useReferenceCodesTable, useReferenceDataIndex } from "@/api/referenceData";
import { cn } from "@/lib/cn";
import type { ItemClass, ReferenceCode } from "@/api/types";

const codeColumns: ColumnDef<ReferenceCode, unknown>[] = [
  { id: "cd", header: "Code", accessorFn: (c) => c.cd },
  { id: "cd_nm", header: "Name", accessorFn: (c) => c.cd_nm },
  { id: "srt_ord", header: "Sort order", accessorFn: (c) => c.srt_ord },
  { id: "use_yn", header: "In use", accessorFn: (c) => (c.use_yn === "Y" ? "Yes" : "No") },
];

const itemClassColumns: ColumnDef<ItemClass, unknown>[] = [
  { id: "item_cls_cd", header: "Code", accessorFn: (c) => c.item_cls_cd },
  { id: "item_cls_nm", header: "Name", accessorFn: (c) => c.item_cls_nm },
  { id: "item_cls_lvl", header: "Level", accessorFn: (c) => c.item_cls_lvl },
  { id: "tax_ty_cd", header: "Tax type", accessorFn: (c) => c.tax_ty_cd ?? "—" },
  { id: "use_yn", header: "In use", accessorFn: (c) => (c.use_yn === "Y" ? "Yes" : "No") },
];

export function ReferenceDataPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "codes";

  return (
    <div>
      <PageHeader
        title="Reference data"
        description="KRA's cached code lists and item classification hierarchy — see a customer's own page to restrict which of these it may submit."
      />

      <Tabs value={tab} onValueChange={(next) => setSearchParams({ tab: next }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="codes">Codes</TabsTrigger>
          <TabsTrigger value="item-classes">Item classifications</TabsTrigger>
        </TabsList>

        <TabsContent value="codes">
          <CodesTab />
        </TabsContent>

        <TabsContent value="item-classes">
          <ItemClassesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CodesTab() {
  const indexQuery = useReferenceDataIndex();
  const [classification, setClassification] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!classification && indexQuery.data?.length) setClassification(indexQuery.data[0].classification);
  }, [classification, indexQuery.data]);

  const { state, setPage, setSort, setSearch } = useDataTableState([]);
  const query = useReferenceCodesTable(classification, state);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
      <Card>
        <CardContent className="p-2">
          {indexQuery.isLoading ? (
            <p className="p-2 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ul className="space-y-0.5">
              {indexQuery.data?.map((entry) => (
                <li key={entry.classification}>
                  <button
                    type="button"
                    onClick={() => setClassification(entry.classification)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                      classification === entry.classification && "bg-muted font-medium",
                    )}
                  >
                    <span>{entry.classification}</span>
                    <span className="text-xs text-muted-foreground">{entry.code_count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <DataTable
        columns={codeColumns}
        page={query.data}
        isLoading={query.isLoading}
        isError={query.isError}
        tableState={state}
        onSortChange={setSort}
        onSearchChange={setSearch}
        onPageChange={setPage}
        searchPlaceholder="Search by code or name…"
        emptyState="No codes cached for this classification yet."
      />
    </div>
  );
}

function ItemClassesTab() {
  const { state, setPage, setSort, setSearch, setFilter } = useDataTableState(["level"]);
  const query = useItemClassesTable({ ...state, level: state.filters.level });

  return (
    <DataTable
      columns={itemClassColumns}
      page={query.data}
      isLoading={query.isLoading}
      isError={query.isError}
      tableState={state}
      onSortChange={setSort}
      onSearchChange={setSearch}
      onPageChange={setPage}
      searchPlaceholder="Search by code or name…"
      emptyState="No item classifications cached yet."
      toolbarExtra={
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={state.filters.level ?? ""}
          onChange={(e) => setFilter("level", e.target.value || undefined)}
          aria-label="Filter by level"
        >
          <option value="">All levels</option>
          <option value="1">Level 1 — Segment</option>
          <option value="2">Level 2 — Family</option>
          <option value="3">Level 3 — Class</option>
        </select>
      }
    />
  );
}
