"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchProductsByIds } from "@/lib/api-client";
import type { Product } from "@/types";

/**
 * Fresh products for a list of persisted ids (compare, wishlist, recently
 * viewed) via GET /api/products/by-ids. Results follow the order of `ids`, and
 * removals show immediately (no refetch needed to drop a row).
 */
export function useProductsByIds(ids: string[]) {
  const key = useMemo(() => [...ids].sort(), [ids]);

  const query = useQuery({
    queryKey: ["products", "by-ids", key],
    queryFn: ({ signal }) => fetchProductsByIds(key, signal),
    enabled: key.length > 0,
    placeholderData: keepPreviousData,
  });

  const products = useMemo(() => {
    const byId = new Map((query.data ?? []).map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is Product => !!p);
  }, [ids, query.data]);

  return {
    products,
    /** True while the first response for these ids is pending. */
    isLoading: key.length > 0 && query.isPending,
    isError: query.isError,
  };
}
