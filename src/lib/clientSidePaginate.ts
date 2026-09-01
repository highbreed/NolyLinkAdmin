/**
 * Some real backend endpoints (GET /v1/customers, GET /v1/admin/branches) return a flat array
 * with no page/sort/search query-param support at all — unlike the mocked-only endpoints,
 * which do. Rather than pretend a server-side contract exists, this applies the same
 * page/sort/search shape client-side over an already-fetched (and react-query-cached) full
 * list, so DataTable can stay agnostic to which kind of source it's rendering.
 */
import type { DataTableState } from "@/components/data-table/useDataTableState";
import type { Page } from "@/api/types";

export function paginateClientSide<T>(
  items: T[],
  state: Pick<DataTableState, "page" | "pageSize" | "sort" | "search">,
  opts: {
    searchFields?: (item: T) => string[];
    sortAccessor?: (item: T, id: string) => string | number;
  } = {},
): Page<T> {
  let filtered = items;

  const q = state.search.trim().toLowerCase();
  if (q && opts.searchFields) {
    filtered = filtered.filter((item) => opts.searchFields!(item).some((f) => f.toLowerCase().includes(q)));
  }

  if (state.sort && opts.sortAccessor) {
    const { id, desc } = state.sort;
    filtered = [...filtered].sort((a, b) => {
      const av = opts.sortAccessor!(a, id);
      const bv = opts.sortAccessor!(b, id);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return desc ? -cmp : cmp;
    });
  }

  const start = (state.page - 1) * state.pageSize;
  return {
    items: filtered.slice(start, start + state.pageSize),
    total: filtered.length,
    page: state.page,
    page_size: state.pageSize,
  };
}
