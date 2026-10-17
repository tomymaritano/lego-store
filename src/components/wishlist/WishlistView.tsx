"use client";

import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { ArrowRight, Heart, ShoppingCart, Trash2 } from "lucide-react";
import { fadeIn, fadeInUp } from "@/lib/motion";
import { pluralize } from "@/lib/utils";
import { useCartItems, useStoreHydrated, useWishlistItems, useWishlistStore } from "@/stores";
import { productActionCopy } from "@/hooks/useProductActions";
import { useProductsByIds } from "@/hooks/useProductsByIds";
import { Button, EmptyState, Skeleton, showToast } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { RecommendedProducts } from "@/components/product/RecommendedProducts";
import type { Product } from "@/types";
import { SavedCard } from "./SavedCard";
import { focusAfterRemoval, isFull, moveAllToCart, toSaved } from "./wishlistActions";

/**
 * Wishlist page body (client island). Saved items are stored snapshots;
 * fresh prices, stock and themes are hydrated by id through the by-ids Route
 * Handler (lib/api). `recommended` comes from the Server Component for the
 * empty state.
 */
export function WishlistView({ recommended }: { recommended: Product[] }) {
  const hydrated = useStoreHydrated(useWishlistStore);
  const wishlist = useWishlistItems();
  const { products } = useProductsByIds(
    wishlist.map((item) => item.id),
    { onMissing: useWishlistStore.getState().removeMany }
  );
  const fresh = new Map(products.map((p) => [p.id, p]));
  const saved = wishlist.map((item) => toSaved(item, fresh.get(item.id)));
  const cart = useCartItems();
  const lines = new Map(cart.map((line) => [line.id, line]));
  // What "Mover todo" can move: in stock and not already at the limit in the cart.
  const movable = saved.filter((p) => {
    const line = lines.get(p.id);
    return p.stock > 0 && !(line && isFull(line, p));
  });
  const empty = hydrated && wishlist.length === 0;

  /** Undo puts back only the cleared items; anything saved since then stays. */
  const clearAll = () => {
    const before = useWishlistStore.getState().wishlist;
    useWishlistStore.getState().clearWishlist();
    focusAfterRemoval(undefined);
    showToast.undo(productActionCopy.wishlistCleared(), () => {
      const { restoreItem } = useWishlistStore.getState();
      before.forEach((item, index) => restoreItem(item, { index }));
    });
  };

  return (
    // min-h keeps the footer below the fold while the persisted list hydrates (no CLS when the
    // skeleton gives way to the taller empty state).
    <div className="container-custom min-h-[calc(100dvh-6rem)] py-8 md:py-12">
      <PageHeader
        title="Favoritos"
        titleId="wishlist-title"
        breadcrumbs={[{ label: "Favoritos" }]}
        description={
          hydrated && !empty ? (
            <p data-testid="wishlist-page-count">
              {pluralize(wishlist.length, "producto guardado", "productos guardados")}
            </p>
          ) : null
        }
        actions={
          hydrated && !empty ? (
            <>
              <Button variant="ghost" size="sm" onClick={clearAll} className="hover:text-danger">
                <Trash2 aria-hidden="true" />
                Vaciar favoritos
              </Button>
              {movable.length > 1 ? (
                <Button variant="secondary" size="sm" onClick={() => moveAllToCart(movable)}>
                  <ShoppingCart aria-hidden="true" />
                  Mover todo al carrito
                </Button>
              ) : null}
            </>
          ) : null
        }
      />

      {!hydrated ? (
        <div aria-busy="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
          <span className="sr-only">Cargando favoritos…</span>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-96 rounded-2xl" />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {empty ? (
            <m.div key="empty" variants={fadeInUp} initial="hidden" animate="visible" exit="exit">
              <div className="rounded-2xl border border-dashed border-border-strong bg-bg-subtle">
                <EmptyState
                  icon={<Heart />}
                  title="Todavía no tienes favoritos"
                  description="Toca el corazón de cualquier set para guardarlo y comprarlo más tarde."
                  action={
                    <Button size="lg" render={<Link href="/" />}>
                      Explorar productos
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  }
                />
              </div>
              <RecommendedProducts products={recommended} />
            </m.div>
          ) : (
            <m.ul
              key="grid"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4"
              aria-label="Productos guardados"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {saved.map((product, index) => (
                  <SavedCard key={product.id} product={product} index={index} />
                ))}
              </AnimatePresence>
            </m.ul>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
