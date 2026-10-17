"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, Heart, Trash2 } from "lucide-react";
import { scaleIn, transitions } from "@/lib/motion";
import { useStoreHydrated, useWishlistItems, useWishlistStore } from "@/stores";
import { useProductActions } from "@/hooks/useProductActions";
import { useProductsByIds } from "@/hooks/useProductsByIds";
import { Button, EmptyState, IconButton, Price, Skeleton } from "@/components/ui";
import { AddToCartButton, ProductImage } from "@/components/product";
import type { Product, WishlistItem } from "@/types";

/** One saved product: fresh catalogue data when loaded, the stored snapshot until then. */
function WishlistCard({ item, product }: { item: WishlistItem; product?: Product }) {
  const summary = product ?? { id: item.id, name: item.name, price: item.price, img: item.image, stock: item.stock };
  const { isAvailable, toggleWishlist } = useProductActions(summary);

  return (
    <motion.li
      layout
      transition={transitions.spring}
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
    >
      <div className="relative aspect-square bg-bg-subtle">
        <ProductImage src={summary.img} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-contain p-4" />
        <IconButton
          label={`Quitar ${summary.name} de favoritos`}
          variant="secondary"
          size="icon-sm"
          className="absolute top-3 right-3 z-10 shadow-md hover:text-danger"
          onClick={toggleWishlist}
        >
          <Trash2 aria-hidden="true" />
        </IconButton>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="text-body font-semibold">
          <Link
            href={`/item/${summary.id}`}
            className="line-clamp-2 text-fg after:absolute after:inset-0 after:content-[''] hover:text-info"
          >
            {summary.name}
          </Link>
        </h2>
        <Price
          value={summary.price}
          originalValue={product?.isOnSale ? product.originalPrice : undefined}
          size="md"
        />
        {!isAvailable && <p className="text-sm font-medium text-danger">Producto agotado</p>}

        <AddToCartButton product={summary} className="relative z-10 mt-auto w-full" />
      </div>
    </motion.li>
  );
}

export default function WishlistPage() {
  const hydrated = useStoreHydrated(useWishlistStore);
  const wishlist = useWishlistItems();
  const clearWishlist = useWishlistStore((state) => state.clearWishlist);
  const { products } = useProductsByIds(
    wishlist.map((item) => item.id),
    { onMissing: useWishlistStore.getState().removeMany }
  );
  const fresh = new Map(products.map((p) => [p.id, p]));

  if (!hydrated) {
    return (
      <div className="container-custom py-8" aria-busy="true">
        <h1 className="sr-only">Lista de deseos</h1>
        <Skeleton className="mb-8 h-10 w-48" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  if (wishlist.length === 0) {
    return (
      <div className="container-custom py-16">
        <h1 className="sr-only">Lista de deseos</h1>
        <EmptyState
          icon={<Heart />}
          title="Tu lista de deseos está vacía"
          description="Guarda tus productos favoritos para comprarlos más tarde."
          action={
            <Button size="lg" render={<Link href="/" />}>
              <ChevronLeft aria-hidden="true" />
              Explorar productos
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-custom py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl">Lista de deseos</h1>
          <p className="mt-1 text-fg-muted">
            {wishlist.length} {wishlist.length === 1 ? "producto guardado" : "productos guardados"}
          </p>
        </div>
        <Button variant="ghost" onClick={clearWishlist}>
          Vaciar lista
        </Button>
      </div>

      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Productos guardados">
        <AnimatePresence mode="popLayout" initial={false}>
          {wishlist.map((item) => (
            <WishlistCard key={item.id} item={item} product={fresh.get(item.id)} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
