"use client";

import { useRef, type Ref } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Heart, ShoppingCart, Trash2 } from "lucide-react";
import { fadeIn, fadeInUp, gridItem, transitions } from "@/lib/motion";
import { flyToCart } from "@/lib/flyToCart";
import { cn, pluralize } from "@/lib/utils";
import { useCartStore, useIsInCart, useStoreHydrated, useWishlistItems, useWishlistStore } from "@/stores";
import { productActionCopy } from "@/hooks/useProductActions";
import { useProductsByIds } from "@/hooks/useProductsByIds";
import { Badge, Button, EmptyState, IconButton, Price, Skeleton, cardVariants, showToast } from "@/components/ui";
import { ProductImage } from "@/components/product/ProductImage";
import { RecommendedProducts } from "@/components/product/RecommendedProducts";
import type { Product, ProductSummary, WishlistItem } from "@/types";

/** What a saved row shows: fresh catalogue data when loaded, the stored snapshot until then. */
interface SavedProduct extends ProductSummary {
  theme?: string;
  originalPrice?: number;
}

function toSaved(item: WishlistItem, product?: Product): SavedProduct {
  if (product) {
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      img: product.img,
      stock: product.stock,
      theme: product.theme,
      originalPrice: product.isOnSale ? product.originalPrice : undefined,
    };
  }
  return { id: item.id, name: item.name, price: item.price, img: item.image, stock: item.stock };
}

/** Focus after a card leaves: the neighbour's remove button, or the heading. */
function focusAfterRemoval(neighbourId: string | undefined) {
  requestAnimationFrame(() => {
    const next =
      neighbourId && document.querySelector<HTMLElement>(`[data-remove-saved="${CSS.escape(neighbourId)}"]`);
    (next || document.getElementById("wishlist-title"))?.focus();
  });
}

/** Takes an item out of the wishlist, remembering where it was so undo can put it back. */
function takeOut(id: string) {
  const { wishlist, removeFromWishlist, restoreItem } = useWishlistStore.getState();
  const index = wishlist.findIndex((item) => item.id === id);
  const item = wishlist[index];
  const neighbour = wishlist[index + 1] ?? wishlist[index - 1];
  removeFromWishlist(id);
  focusAfterRemoval(neighbour?.id);
  return () => item && restoreItem(item, index);
}

function remove(product: SavedProduct) {
  const undo = takeOut(product.id);
  showToast.undo(productActionCopy.removedFromWishlist(product.name), undo);
}

/** Adds one unit to the cart and drops the product from the wishlist; undo reverts both. */
function moveToCart(product: SavedProduct) {
  const cart = useCartStore.getState();
  const before = cart.cart.find((line) => line.id === product.id)?.quantity;
  cart.addItem(product, 1);
  const undoWishlist = takeOut(product.id);
  showToast.undo(productActionCopy.movedToCart(product.name), () => {
    undoWishlist();
    const { setQuantity, removeItem } = useCartStore.getState();
    if (before) setQuantity(product.id, before);
    else removeItem(product.id);
  });
}

function SavedCard({ product, index, ref }: { product: SavedProduct; index: number; ref?: Ref<HTMLLIElement> }) {
  const imageRef = useRef<HTMLSpanElement>(null);
  const inCart = useIsInCart(product.id);
  const available = product.stock > 0;
  const titleId = `saved-${product.id}-title`;

  return (
    <motion.li
      ref={ref}
      layout
      custom={index}
      variants={gridItem}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ layout: transitions.spring }}
      aria-labelledby={titleId}
      className={cn(cardVariants({ interactive: true }), "group relative flex flex-col overflow-hidden")}
      data-testid="wishlist-item"
    >
      <div className="relative aspect-[4/3] bg-bg-subtle">
        <Link href={`/item/${product.id}`} tabIndex={-1} aria-hidden="true" className="absolute inset-0 p-5">
          <span ref={imageRef} className="relative block size-full">
            <ProductImage
              src={product.img}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-contain transition-[scale] duration-slow ease-emphasized group-hover:scale-105"
            />
          </span>
        </Link>
        {!available ? (
          <Badge variant="neutral" className="absolute top-3 left-3">
            Agotado
          </Badge>
        ) : null}
        <IconButton
          label={`Quitar ${product.name} de favoritos`}
          variant="secondary"
          size="icon-sm"
          className="absolute top-3 right-3 shadow-md hover:text-danger"
          onClick={() => remove(product)}
          data-remove-saved={product.id}
        >
          <Trash2 aria-hidden="true" />
        </IconButton>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.theme ? (
          <p className="text-caption font-semibold tracking-wider text-info uppercase">{product.theme}</p>
        ) : null}
        <h2 id={titleId} className="text-body leading-snug font-bold">
          <Link href={`/item/${product.id}`} className="line-clamp-2 rounded-sm text-fg hover:text-info">
            {product.name}
          </Link>
        </h2>
        <Price value={product.price} originalValue={product.originalPrice} size="md" className="mt-auto pt-1" />
        <Button
          size="sm"
          className="mt-2 w-full"
          disabled={!available}
          onClick={() => {
            flyToCart(imageRef.current, product.img);
            moveToCart(product);
          }}
          data-testid="move-to-cart-btn"
        >
          <ShoppingCart aria-hidden="true" />
          {available ? "Mover al carrito" : "Agotado"}
        </Button>
        {inCart ? <p className="text-center text-caption text-fg-muted">Ya tienes este set en el carrito</p> : null}
      </div>
    </motion.li>
  );
}

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
  const available = saved.filter((p) => p.stock > 0);
  const empty = hydrated && wishlist.length === 0;

  const moveAll = () => {
    const cartBefore = useCartStore.getState().cart;
    const wishlistBefore = useWishlistStore.getState().wishlist;
    const { addItem } = useCartStore.getState();
    available.forEach((product) => addItem(product, 1));
    useWishlistStore.getState().removeMany(available.map((p) => p.id));
    focusAfterRemoval(useWishlistStore.getState().wishlist[0]?.id);
    showToast.undo(productActionCopy.movedAllToCart(available.length), () => {
      useCartStore.setState({ cart: cartBefore });
      useWishlistStore.setState({ wishlist: wishlistBefore });
    });
  };

  const clearAll = () => {
    const before = useWishlistStore.getState().wishlist;
    useWishlistStore.getState().clearWishlist();
    focusAfterRemoval(undefined);
    showToast.undo(productActionCopy.wishlistCleared(), () => useWishlistStore.setState({ wishlist: before }));
  };

  return (
    <div className="container-custom py-8 md:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div>
          <h1 id="wishlist-title" tabIndex={-1} className="text-3xl outline-none md:text-4xl">
            Lista de deseos
          </h1>
          {hydrated && !empty ? (
            <p className="mt-1 text-fg-muted" data-testid="wishlist-page-count">
              {pluralize(wishlist.length, "producto guardado", "productos guardados")}
            </p>
          ) : null}
        </div>
        {hydrated && !empty ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={clearAll} className="hover:text-danger">
              <Trash2 aria-hidden="true" />
              Vaciar lista
            </Button>
            {available.length > 1 ? (
              <Button variant="secondary" size="sm" onClick={moveAll}>
                <ShoppingCart aria-hidden="true" />
                Mover todo al carrito
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {!hydrated ? (
        <div aria-busy="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
          <span className="sr-only">Cargando lista de deseos…</span>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-96 rounded-2xl" />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {empty ? (
            <motion.div key="empty" variants={fadeInUp} initial="hidden" animate="visible" exit="exit">
              <div className="rounded-2xl border border-dashed border-border-strong bg-bg-subtle">
                <EmptyState
                  icon={<Heart />}
                  title="Tu lista de deseos está vacía"
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
            </motion.div>
          ) : (
            <motion.ul
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
            </motion.ul>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
