"use client";

import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { ArrowRight, ShoppingBag, Trash2 } from "lucide-react";
import { fadeIn, fadeInUp } from "@/lib/motion";
import { pluralize } from "@/lib/utils";
import { positionIn, useCartCount, useCartItems, useCartStore, useStoreHydrated } from "@/stores";
import { productActionCopy } from "@/hooks/useProductActions";
import { Button, EmptyState, Skeleton, showToast } from "@/components/ui";
import { RecommendedProducts } from "@/components/product/RecommendedProducts";
import { PageHeader } from "@/components/layout/PageHeader";
import type { CartItem, Product } from "@/types";
import { CartLine } from "./CartLine";
import { OrderSummary } from "./OrderSummary";

/**
 * Keyboard focus after a line disappears: the neighbouring line's remove
 * button, or the page heading when the cart is now empty, never <body>.
 */
function focusAfterRemoval(neighbourId: string | undefined) {
  requestAnimationFrame(() => {
    const next = neighbourId && document.querySelector<HTMLElement>(`[data-remove-line="${CSS.escape(neighbourId)}"]`);
    (next || document.getElementById("cart-title"))?.focus();
  });
}

function removeLine(item: CartItem) {
  const { cart, removeItem, restoreItem } = useCartStore.getState();
  const at = positionIn(
    cart.map((line) => line.id),
    item.id
  );
  const neighbour = cart[at.index + 1] ?? cart[at.index - 1];
  removeItem(item.id);
  focusAfterRemoval(neighbour?.id);
  showToast.undo(productActionCopy.removedFromCart(item.name), () => restoreItem(item, at));
}

function clearAll() {
  const { cart, clearCart, restoreItem } = useCartStore.getState();
  const snapshot = cart;
  clearCart();
  focusAfterRemoval(undefined);
  showToast.undo(productActionCopy.cartCleared(), () =>
    snapshot.forEach((line, index) => restoreItem(line, { index }))
  );
}

function CartSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-6 lg:grid-cols-3 lg:gap-8">
      <span className="sr-only">Cargando carrito…</span>
      <div className="space-y-4 lg:col-span-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}

/**
 * The cart page body (client island): the lines, the order summary, and the
 * empty state with recommended products. `recommended` comes from the Server
 * Component (lib/api), so an empty cart never waits on a client fetch.
 */
export function CartView({ recommended }: { recommended: Product[] }) {
  const hydrated = useStoreHydrated(useCartStore);
  const cart = useCartItems();
  const count = useCartCount();
  const setQuantity = useCartStore((state) => state.setQuantity);
  const empty = hydrated && cart.length === 0;

  return (
    // min-h keeps the footer below the fold while the persisted cart hydrates, so swapping the
    // skeleton for the (taller) empty state never shifts it on screen (CLS).
    <div className="container-custom min-h-[calc(100dvh-6rem)] py-8 md:py-12">
      <PageHeader
        title="Carrito de compras"
        titleId="cart-title"
        breadcrumbs={[{ label: "Carrito" }]}
        description={
          hydrated && !empty ? <p data-testid="cart-page-count">{pluralize(count, "producto")}</p> : null
        }
        actions={
          hydrated && !empty ? (
            <Button variant="ghost" size="sm" onClick={clearAll} className="hover:text-danger">
              <Trash2 aria-hidden="true" />
              Vaciar carrito
            </Button>
          ) : null
        }
      />

      {!hydrated ? (
        <CartSkeleton />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {empty ? (
            <m.div key="empty" variants={fadeInUp} initial="hidden" animate="visible" exit="exit">
              <div className="rounded-2xl border border-dashed border-border-strong bg-bg-subtle">
                <EmptyState
                  icon={<ShoppingBag />}
                  title="Tu carrito está vacío"
                  description="Todavía no agregaste productos. ¡Hay sets esperando ser construidos!"
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
            <m.div
              key="lines"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="grid items-start gap-6 lg:grid-cols-3 lg:gap-8"
            >
              <ul className="space-y-3 sm:space-y-4 lg:col-span-2" aria-label="Productos en el carrito">
                <AnimatePresence mode="popLayout" initial={false}>
                  {cart.map((item, index) => (
                    <CartLine
                      key={item.id}
                      item={item}
                      priority={index < 3}
                      onQuantityChange={(quantity) => setQuantity(item.id, quantity)}
                      onRemove={() => removeLine(item)}
                    />
                  ))}
                </AnimatePresence>
              </ul>

              <OrderSummary lines={cart} className="lg:sticky lg:top-24" />
            </m.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
