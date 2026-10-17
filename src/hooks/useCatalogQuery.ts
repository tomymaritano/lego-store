"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { parseProductQuery, serializeProductQuery, withoutFilters } from "@/lib/productQuery";
import type { ProductQuery } from "@/types";

/**
 * The catalogue query (search, filters, sort) kept in the URL. Changes go
 * through `history.pushState`, which Next's router picks up: the URL is
 * shareable, Back/Forward walk through filter states, and nothing re-renders
 * on the server (results come from GET /api/products).
 *
 * Paging is never put in the URL (infinite scroll), and the path scope
 * (/category/[id]) stays in the path.
 */
export function useCatalogQuery() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const query = useMemo(() => {
    const { page: _page, limit: _limit, ...rest } = parseProductQuery(new URLSearchParams(search));
    void _page;
    void _limit;
    return rest;
  }, [search]);

  const setQuery = useCallback(
    (next: ProductQuery) => {
      const params = serializeProductQuery({ ...next, page: undefined, limit: undefined }).toString();
      if (params === search) return;
      window.history.pushState(null, "", params ? `${pathname}?${params}` : pathname);
    },
    [pathname, search]
  );

  /** Merges a partial change; `undefined` or an empty list removes a filter. */
  const update = useCallback((patch: Partial<ProductQuery>) => setQuery({ ...query, ...patch }), [query, setQuery]);

  /** Removes every filter; keeps the search text and the sort order. */
  const clear = useCallback(() => setQuery(withoutFilters(query)), [query, setQuery]);

  return { query, setQuery, update, clear };
}
