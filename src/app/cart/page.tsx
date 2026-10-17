"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ShoppingBag, Trash2 } from "lucide-react";
import { dismissible, transitions } from "@/lib/motion";
import { formatPrice } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { useCartCount, useCartItems, useCartStore, useCartSubtotal, useStoreHydrated } from "@/stores";
import { productActionCopy } from "@/hooks/useProductActions";
import { Button, EmptyState, IconButton, QuantitySelector, Skeleton, showToast } from "@/components/ui";

export default function CartPage() {
  const hydrated = useStoreHydrated(useCartStore);
  const cart = useCartItems();
  const count = useCartCount();
  const subtotal = useCartSubtotal();
  const removeItem = useCartStore((state) => state.removeItem);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const clearCart = useCartStore((state) => state.clearCart);

  const { freeShippingThreshold, shippingCost } = siteConfig.commerce;
  const shipping = subtotal >= freeShippingThreshold ? 0 : shippingCost;
  const missingForFreeShipping = freeShippingThreshold - subtotal;

  if (!hydrated) {
    return (
      <div className="container-custom py-8" aria-busy="true">
        <h1 className="sr-only">Carrito de compras</h1>
        <Skeleton className="mb-8 h-10 w-48" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="container-custom py-16">
        <h1 className="sr-only">Carrito de compras</h1>
        <EmptyState
          icon={<ShoppingBag />}
          title="Tu carrito está vacío"
          description="Parece que aún no has agregado productos a tu carrito. ¡Explora nuestra tienda!"
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
          <h1 className="text-3xl md:text-4xl">Carrito de compras</h1>
          <p className="mt-1 text-fg-muted">
            {count} {count === 1 ? "producto" : "productos"}
          </p>
        </div>
        <Button variant="ghost" onClick={clearCart}>
          Vaciar carrito
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <ul className="space-y-4 lg:col-span-2" aria-label="Productos en el carrito">
          <AnimatePresence mode="popLayout" initial={false}>
            {cart.map((item) => (
              <motion.li
                key={item.id}
                layout
                transition={transitions.spring}
                variants={dismissible}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card"
                data-testid="cart-item"
              >
                <Link href={`/item/${item.id}`} className="shrink-0 rounded-lg" tabIndex={-1} aria-hidden="true">
                  <span className="relative block size-24 overflow-hidden rounded-lg bg-bg-subtle">
                    <Image src={item.image} alt="" fill sizes="96px" className="object-contain p-2" />
                  </span>
                </Link>

                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-body font-semibold">
                    <Link href={`/item/${item.id}`} className="text-fg hover:text-info">
                      {item.name}
                    </Link>
                  </h2>
                  <p className="mt-1 text-lg font-bold text-fg tabular-nums">{formatPrice(item.price)}</p>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <QuantitySelector
                      value={item.quantity}
                      onValueChange={(quantity) => setQuantity(item.id, quantity)}
                      max={item.stock}
                      size="sm"
                      label={`Cantidad de ${item.name}`}
                    />

                    <div className="flex items-center gap-3">
                      <span className="text-sm text-fg-muted tabular-nums">
                        Subtotal: {formatPrice(item.price * item.quantity)}
                      </span>
                      <IconButton
                        label={`Eliminar ${item.name} del carrito`}
                        size="icon-sm"
                        className="hover:text-danger"
                        onClick={() => {
                          removeItem(item.id);
                          showToast.info(productActionCopy.removedFromCart(item.name));
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <aside aria-labelledby="summary-title" className="lg:col-span-1">
          <div className="sticky top-24 rounded-2xl border border-border bg-surface p-6 shadow-card">
            <h2 id="summary-title" className="mb-4 text-title">
              Resumen del pedido
            </h2>

            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-fg-muted">Subtotal ({count} productos)</dt>
                <dd className="text-fg tabular-nums">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">Envío</dt>
                <dd className={shipping === 0 ? "font-semibold text-success" : "text-fg tabular-nums"}>
                  {shipping === 0 ? "Gratis" : formatPrice(shipping)}
                </dd>
              </div>
            </dl>

            {missingForFreeShipping > 0 && (
              <p className="mt-3 rounded-lg bg-bg-subtle p-3 text-caption text-fg-secondary">
                Te faltan {formatPrice(missingForFreeShipping)} para el envío gratis.
              </p>
            )}

            <div className="mt-4 flex justify-between border-t border-border pt-4 text-lg font-bold text-fg">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(subtotal + shipping)}</span>
            </div>

            <Button className="mt-6 w-full" size="lg" render={<Link href="/checkout" />}>
              Finalizar compra
            </Button>

            <Button variant="outline" className="mt-4 w-full" render={<Link href="/" />}>
              <ChevronLeft aria-hidden="true" />
              Seguir comprando
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
