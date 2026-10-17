"use client";

import { useEffect, useMemo, useRef } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchProductsByIds } from "@/lib/api-client";
import { MAX_IDS_PER_REQUEST } from "@/lib/productQuery";
import type { Product } from "@/types";

interface Options {
  /**
   * Called with the requested ids the API did not return (deleted or re-IDed
   * products), so the owning store can drop them. Only fires for a settled,
   * successful response to exactly these ids — never on errors or placeholders.
   */
  onMissing?: (missingIds: string[]) => void;
}

/**
 * Fresh products for a list of persisted ids (compare, wishlist, recently
 * viewed) via GET /api/products/by-ids. Results follow the order of `ids`, and
 * removals show immediately (no refetch needed to drop a row).
 */
export function useProductsByIds(ids: string[], { onMissing }: Options = {}) {
  const idsKey = ids.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by content, not identity
  const key = useMemo(() => Array.from(new Set(ids)).sort(), [idsKey]);

  const query = useQuery({
    queryKey: ["products", "by-ids", key],
    queryFn: ({ signal }) => fetchProductsByIds(key, signal),
    enabled: key.length > 0,
    placeholderData: keepPreviousData,
  });

  const onMissingRef = useRef(onMissing);
  useEffect(() => {
    onMissingRef.current = onMissing;
  });

  const settled = query.isSuccess && !query.isPlaceholderData ? query.data : undefined;
  useEffect(() => {
    if (!settled || !onMissingRef.current) return;
    const found = new Set(settled.map((p) => p.id));
    // The API resolves at most MAX_IDS_PER_REQUEST ids; ids past that are unknown, not missing.
    const missing = key.slice(0, MAX_IDS_PER_REQUEST).filter((id) => !found.has(id));
    if (missing.length > 0) onMissingRef.current(missing);
  }, [settled, key]);

  const products = useMemo(() => {
    const byId = new Map((query.data ?? []).map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is Product => !!p);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by content, not identity
  }, [idsKey, query.data]);

  return {
    products,
    /** True while the first response for these ids is pending. */
    isLoading: key.length > 0 && query.isPending,
    isError: query.isError,
  };
}
