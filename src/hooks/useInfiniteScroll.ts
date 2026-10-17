"use client";

import { useEffect, useRef } from "react";

interface UseInfiniteScrollOptions {
  /** Called when the sentinel scrolls into view (and `enabled`). */
  onLoadMore: () => void;
  enabled: boolean;
  /** Start loading this far before the sentinel is visible. */
  rootMargin?: string;
}

/**
 * Returns a ref for a sentinel element placed after a list; when it comes
 * into view, `onLoadMore` runs. The caller owns the data (e.g. React Query's
 * useInfiniteQuery) and keeps a "Cargar más" button as a fallback.
 */
export function useInfiniteScroll<T extends Element = HTMLDivElement>({
  onLoadMore,
  enabled,
  rootMargin = "400px 0px",
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<T>(null);
  const callbackRef = useRef(onLoadMore);

  useEffect(() => {
    callbackRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!enabled || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callbackRef.current();
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return sentinelRef;
}
