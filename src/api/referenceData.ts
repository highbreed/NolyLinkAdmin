/**
 * Admin-only reference-data browsing: the cached KRA code lists (`kra_code_lists`) and item
 * classification hierarchy (`kra_item_classes`). Real endpoints — see
 * kra_vscu_backend/docs/reference_data_and_code_assignment.md §3. Both list endpoints return
 * a flat, unpaginated array (the item-classes one is ~1000 rows), so — same convention as
 * api/branches.ts/customers.ts — pagination/sort/search are applied client-side
 * (src/lib/clientSidePaginate.ts) over the cached full list, not sent as query params.
 */
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { paginateClientSide } from "@/lib/clientSidePaginate";
import type { DataTableState } from "@/components/data-table/useDataTableState";
import type { ItemClass, Page, ReferenceCode, ReferenceCodeClassification } from "@/api/types";

export function useReferenceDataIndex() {
  return useQuery({
    queryKey: ["reference-data", "index"],
    queryFn: () => apiRequest<ReferenceCodeClassification[]>("/v1/admin/reference-data/codes"),
  });
}

export function useReferenceCodes(classification: string | undefined) {
  return useQuery({
    queryKey: ["reference-data", "codes", classification],
    queryFn: () => apiRequest<ReferenceCode[]>(`/v1/admin/reference-data/codes/${classification}`),
    enabled: !!classification,
  });
}

export function useReferenceCodesTable(
  classification: string | undefined,
  tableState: Pick<DataTableState, "page" | "pageSize" | "sort" | "search">,
): { data: Page<ReferenceCode> | undefined; isLoading: boolean; isError: boolean } {
  const query = useReferenceCodes(classification);
  const data = query.data
    ? paginateClientSide(query.data, tableState, {
        searchFields: (c) => [c.cd, c.cd_nm],
        sortAccessor: (c, id) => (id === "srt_ord" ? c.srt_ord : id === "cd" ? c.cd : c.cd_nm),
      })
    : undefined;
  return { data, isLoading: query.isLoading, isError: query.isError };
}

export function useItemClasses() {
  return useQuery({
    queryKey: ["reference-data", "item-classes"],
    queryFn: () => apiRequest<ItemClass[]>("/v1/admin/reference-data/item-classes"),
  });
}

export function useItemClassesTable(
  tableState: Pick<DataTableState, "page" | "pageSize" | "sort" | "search"> & { level?: string },
): { data: Page<ItemClass> | undefined; isLoading: boolean; isError: boolean } {
  const query = useItemClasses();
  const items = query.data?.filter((c) => !tableState.level || c.item_cls_lvl === tableState.level);
  const data = items
    ? paginateClientSide(items, tableState, {
        searchFields: (c) => [c.item_cls_cd, c.item_cls_nm],
        sortAccessor: (c, id) => (id === "item_cls_cd" ? c.item_cls_cd : c.item_cls_nm),
      })
    : undefined;
  return { data, isLoading: query.isLoading, isError: query.isError };
}
