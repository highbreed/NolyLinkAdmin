/**
 * Reads/writes table state (page, pageSize, sort, search, arbitrary filters) to and from the
 * URL's query string via React Router — so every table's state is a real query param, not
 * client-side-only state, and every server-side query hook can derive its TanStack Query key
 * directly from `useSearchParams()`. This is also what makes the dashboard's "click through to
 * a pre-filtered view" acceptance criterion work: a tile just links to `/customers?status=...`.
 */
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { SortParam } from "@/api/types";

export interface DataTableState {
  page: number;
  pageSize: number;
  sort: SortParam | null;
  search: string;
  filters: Record<string, string>;
}

const RESERVED_KEYS = new Set(["page", "pageSize", "sortId", "sortDesc", "q"]);

export function useDataTableState(extraFilterKeys: string[]): {
  state: DataTableState;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSort: (sort: SortParam | null) => void;
  setSearch: (search: string) => void;
  setFilter: (key: string, value: string | undefined) => void;
} {
  const [params, setParams] = useSearchParams();

  const state = useMemo<DataTableState>(() => {
    const filters: Record<string, string> = {};
    for (const key of extraFilterKeys) {
      const value = params.get(key);
      if (value) filters[key] = value;
    }
    const sortId = params.get("sortId");
    return {
      page: Number(params.get("page") ?? "1") || 1,
      pageSize: Number(params.get("pageSize") ?? "20") || 20,
      sort: sortId ? { id: sortId, desc: params.get("sortDesc") === "true" } : null,
      search: params.get("q") ?? "",
      filters,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  const patch = useCallback(
    (updates: Record<string, string | undefined>, resetPage = false) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (value === undefined || value === "") next.delete(key);
            else next.set(key, value);
          }
          if (resetPage) next.set("page", "1");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return {
    state,
    setPage: (page) => patch({ page: String(page) }),
    setPageSize: (size) => patch({ pageSize: String(size) }, true),
    setSort: (sort) => patch({ sortId: sort?.id, sortDesc: sort ? String(sort.desc) : undefined }, true),
    setSearch: (search) => patch({ q: search || undefined }, true),
    setFilter: (key, value) => {
      if (!RESERVED_KEYS.has(key)) patch({ [key]: value }, true);
    },
  };
}
