"use client";

import { useRef, type Ref } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { ArrowRight, Heart, ShoppingCart, Trash2 } from "lucide-react";
import { fadeIn, fadeInUp, gridItem, transitions } from "@/lib/motion";
import { flyToCart } from "@/lib/flyToCart";
import { cn, pluralize } from "@/lib/utils";
import {
  positionIn,
  useCartItems,
  useCartQuantity,
  useCartStore,
  useStoreHydrated,
  useWishlistItems,
  useWishlistStore,
} from "@/stores";
import { productActionCopy } from "@/hooks/useProductActions";
import { useProductsByIds } from "@/hooks/useProductsByIds";
import { Badge, Button, EmptyState, IconButton, Price, Skeleton, cardVariants, showToast } from "@/components/ui";
import { ProductImage } from "@/components/product/ProductImage";
import { RecommendedProducts } from "@/components/product/RecommendedProducts";
import type { CartItem, Product, ProductSummary, WishlistItem } from "@/types";

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

const atCartLimit = "Ya tienes el máximo disponible en el carrito";

/** Takes an item out of the wishlist, remembering where it was so undo can put it back. */
function takeOut(id: string) {
  const { wishlist, removeFromWishlist, restoreItem } = useWishlistStore.getState();
  const at = positionIn(
    wishlist.map((item) => item.id),
    id
  );
  const item = wishlist[at.index];
  const neighbour = wishlist[at.index + 1] ?? wishlist[at.index - 1];
  removeFromWishlist(id);
  focusAfterRemoval(neighbour?.id);
  return () => item && restoreItem(item, at);
}

function remove(product: SavedProduct) {
  const undo = takeOut(product.id);
  showToast.undo(productActionCopy.removedFromWishlist(product.name), undo);
}

/** The cart line already holds all the stock (the line's own, or the fresh catalogue figure). */
const isFull = (line: CartItem, product: SavedProduct) => line.quantity >= Math.min(line.stock, product.stock);

const cartQuantity = (id: string) => useCartStore.getState().cart.find((line) => line.id === id)?.quantity ?? 0;

/** Adds one unit; returns how many units the cart really took (0 at the stock limit). */
function addOne(product: SavedProduct) {
  const before = cartQuantity(product.id);
  useCartStore.getState().addItem(product, 1);
  return cartQuantity(product.id) - before;
}

/**
 * Takes back `added` units of `id` (undo). Works on the cart as it is now, so
 * other lines, and changes made since, are kept.
 */
function takeBackFromCart(id: string, added: number) {
  const { setQuantity, removeItem } = useCartStore.getState();
  const current = cartQuantity(id);
  if (current === 0) return;
  if (current - added <= 0) removeItem(id);
  else setQuantity(id, current - added);
}

/**
 * Adds one unit to the cart and drops the product from the wishlist; undo
 * reverts both. When the cart already holds all the stock nothing is added,
 * so the product stays saved. Returns whether it moved.
 */
function moveToCart(product: SavedProduct) {
  const added = addOne(product);
  if (added === 0) {
    showToast.info(atCartLimit);
    return false;
  }
  const undoWishlist = takeOut(product.id);
  showToast.undo(productActionCopy.movedToCart(product.name), () => {
    undoWishlist();
    takeBackFromCart(product.id, added);
  });
  return true;
}

/**
 * Moves every product the cart can still take. Undo takes back only those
 * units and puts only those items back in the list, so anything added to
 * either list since then stays.
 */
function moveAllToCart(products: SavedProduct[]) {
  const moved = products.flatMap((product) => {
    const added = addOne(product);
    return added > 0 ? [{ id: product.id, added }] : [];
  });
  if (moved.length === 0) {
    showToast.info(atCartLimit);
    return;
  }

  const { wishlist, removeMany } = useWishlistStore.getState();
  const ids = wishlist.map((item) => item.id);
  const saved = moved.flatMap(({ id }) => {
    const item = wishlist.find((entry) => entry.id === id);
    return item ? [{ item, at: positionIn(ids, id) }] : [];
  });
  removeMany(moved.map(({ id }) => id));
  focusAfterRemoval(useWishlistStore.getState().wishlist[0]?.id);

  showToast.undo(productActionCopy.movedAllToCart(moved.length), () => {
    moved.forEach(({ id, added }) => takeBackFromCart(id, added));
    const { restoreItem } = useWishlistStore.getState();
    saved.forEach(({ item, at }) => restoreItem(item, at));
  });
}

function SavedCard({ product, index, ref }: { product: SavedProduct; index: number; ref?: Ref<HTMLLIElement> }) {
  const imageRef = useRef<HTMLSpanElement>(null);
  const inCart = useCartQuantity(product.id);
  const available = product.stock > 0;
  const atLimit = useCartStore((state) => {
    const line = state.cart.find((entry) => entry.id === product.id);
    return available && !!line && isFull(line, product);
  });
  const titleId = `saved-${product.id}-title`;

  return (
    <m.li
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
        {/* Above the price, so price and CTA stay on one line across the row. */}
        {inCart > 0 ? (
          <p className="text-caption text-fg-muted" data-testid="saved-in-cart">
            {atLimit ? atCartLimit : `Ya tienes ${pluralize(inCart, "unidad", "unidades")} en el carrito`}
          </p>
        ) : null}
        <Price value={product.price} originalValue={product.originalPrice} size="md" className="mt-auto pt-1" />
        <Button
          size="sm"
          className="mt-2 w-full"
          disabled={!available || atLimit}
          onClick={() => {
            const image = imageRef.current;
            if (moveToCart(product)) flyToCart(image, product.img);
          }}
          data-testid="move-to-cart-btn"
        >
          <ShoppingCart aria-hidden="true" />
          {!available ? "Agotado" : atLimit ? "Máximo en el carrito" : "Mover al carrito"}
        </Button>
      </div>
    </m.li>
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
            {movable.length > 1 ? (
              <Button variant="secondary" size="sm" onClick={() => moveAllToCart(movable)}>
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
            <m.div key="empty" variants={fadeInUp} initial="hidden" animate="visible" exit="exit">
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
