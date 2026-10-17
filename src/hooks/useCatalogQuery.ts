"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { parseProductQuery, serializeProductQuery, withoutFilters } from "@/lib/productQuery";
import type { ProductQuery } from "@/types";

/** Fired on window after this hook pushes a new query to history. */
const URL_CHANGE = "catalogquerychange";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(URL_CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(URL_CHANGE, onChange);
  };
}

const readSearch = () => window.location.search.replace(/^\?/, "");

/**
 * The catalogue query (search, filters, sort) kept in the URL. Changes go
 * through `history.pushState`, which Next's router picks up: the URL is
 * shareable, Back/Forward walk through filter states, and nothing re-renders
 * on the server (results come from GET /api/products).
 *
 * The URL is read from `window.location` (not `useSearchParams`), so a page
 * that renders CatalogView can still be prerendered: on the server, and
 * while hydrating, the query is `initialQuery` (what the page rendered);
 * right after hydration the real URL takes over. A static category page
 * opened with filters in its URL therefore fetches them on load.
 *
 * Paging is never put in the URL (infinite scroll), and the path scope
 * (/category/[id]) stays in the path: pass its keys as `scopeKeys` so a
 * stray `?category=` on that page is ignored (no chip, no extra fetch) and
 * dropped from the URL on the next change.
 */
export function useCatalogQuery(scopeKeys: readonly (keyof ProductQuery)[] = [], initialQuery: ProductQuery = {}) {
  const pathname = usePathname();
  const serverSearch = serializeProductQuery({ ...initialQuery, page: undefined, limit: undefined }).toString();
  const search = useSyncExternalStore(subscribe, readSearch, () => serverSearch);

  // A server navigation to this page with another query (the navbar search)
  // updates the URL after rendering: read it again once it has.
  useEffect(() => {
    window.dispatchEvent(new Event(URL_CHANGE));
  }, [pathname, serverSearch]);

  const scopeKey = scopeKeys.join(",");
  const query = useMemo(() => {
    const { page: _page, limit: _limit, ...rest } = parseProductQuery(new URLSearchParams(search));
    void _page;
    void _limit;
    const ignored = scopeKey ? scopeKey.split(",") : [];
    for (const key of ignored) delete rest[key as keyof typeof rest];
    return rest;
  }, [search, scopeKey]);

  const setQuery = useCallback(
    (next: ProductQuery) => {
      const params = serializeProductQuery({ ...next, page: undefined, limit: undefined }).toString();
      if (params === readSearch()) return;
      window.history.pushState(null, "", params ? `${pathname}?${params}` : pathname);
      window.dispatchEvent(new Event(URL_CHANGE));
    },
    [pathname]
  );

  /** Merges a partial change; `undefined` or an empty list removes a filter. */
  const update = useCallback((patch: Partial<ProductQuery>) => setQuery({ ...query, ...patch }), [query, setQuery]);

  /** Removes every filter; keeps the search text and the sort order. */
  const clear = useCallback(() => setQuery(withoutFilters(query)), [query, setQuery]);

  return { query, setQuery, update, clear };
}
