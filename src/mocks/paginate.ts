import type { Page } from "@/api/types";

export function paginate<T>(
  items: T[],
  url: URL,
  opts: {
    searchFields?: (item: T) => string[];
    sortAccessor?: (item: T, id: string) => string | number;
  } = {},
): Page<T> {
  const page = Number(url.searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(url.searchParams.get("page_size") ?? "20") || 20;
  const q = url.searchParams.get("q")?.toLowerCase();
  const sort = url.searchParams.get("sort");

  let filtered = items;
  if (q && opts.searchFields) {
    filtered = filtered.filter((item) =>
      opts.searchFields!(item).some((field) => field.toLowerCase().includes(q)),
    );
  }

  if (sort && opts.sortAccessor) {
    const desc = sort.startsWith("-");
    const id = desc ? sort.slice(1) : sort;
    filtered = [...filtered].sort((a, b) => {
      const av = opts.sortAccessor!(a, id);
      const bv = opts.sortAccessor!(b, id);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return desc ? -cmp : cmp;
    });
  }

  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  return { items: pageItems, total: filtered.length, page, page_size: pageSize };
}
