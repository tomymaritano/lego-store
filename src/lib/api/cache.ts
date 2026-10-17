import { revalidateTag, unstable_cache } from "next/cache";

/*
 * Next data cache for catalogue reads (the pre-Cache-Components model:
 * this app does not enable `cacheComponents`). Each read is cached under
 * tags so a write can invalidate exactly what it changed:
 *
 *   products         every product read and list (any product change)
 *   product:<id>     one product (its page, its by-id lookup)
 *   categories       category metadata and counts
 *
 * Statically generated pages that used tagged data are regenerated on the
 * next visit after the tag is invalidated. REVALIDATE_SECONDS is a safety net
 * for a write path that forgets to invalidate, not the freshness mechanism.
 */

export const CATALOG_TAGS = {
  products: "products",
  categories: "categories",
  product: (id: string) => `product:${id}`,
} as const;

const REVALIDATE_SECONDS = 3600;

/** Wraps `fn` in the data cache; the key includes the arguments. */
export function cached<A extends unknown[], R>(
  key: string,
  fn: (...args: A) => Promise<R>,
  tags: (...args: NoInfer<A>) => string[]
): (...args: A) => Promise<R> {
  return (...args: A) =>
    unstable_cache(() => fn(...args), [key, JSON.stringify(args)], {
      tags: tags(...args),
      revalidate: REVALIDATE_SECONDS,
    })();
}

/**
 * Call after any catalogue write (admin edits, stock changes on payment,
 * a new review that moves a rating). Expires immediately: the next read is
 * fresh, never stale. Server Actions and Route Handlers only (not proxy.ts).
 */
export function invalidateCatalog({ productIds = [], categories = false }: { productIds?: string[]; categories?: boolean } = {}) {
  revalidateTag(CATALOG_TAGS.products, { expire: 0 });
  for (const id of productIds) revalidateTag(CATALOG_TAGS.product(id), { expire: 0 });
  // Category counts change when products are created, deleted or moved.
  if (categories) revalidateTag(CATALOG_TAGS.categories, { expire: 0 });
}
