"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { ArrowRight, ShoppingCart, Trash2 } from "lucide-react";
import { useCartCount, useCartItems, useCartStore, useCartSubtotal, useStoreHydrated } from "@/stores";
import { dismissible, fadeIn, transitions } from "@/lib/motion";
import { quoteShipping } from "@/lib/pricing";
import { useShippingRules } from "@/providers/ShippingRulesProvider";
import { formatPrice, pluralize } from "@/lib/utils";
import {
  Button,
  EmptyState,
  IconButton,
  Price,
  QuantitySelector,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Spinner,
  toast,
} from "@/components/ui";
import { ProductImage } from "@/components/product/ProductImage";
import { FreeShippingProgress } from "./FreeShippingProgress";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Mini cart in a right Sheet: lines with quantity and remove (rows animate in,
 * out and into place), free-shipping progress, subtotal and the CTAs to the
 * cart page and checkout.
 */
export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const hydrated = useStoreHydrated(useCartStore);
  const cart = useCartItems();
  const count = useCartCount();
  const subtotal = useCartSubtotal();
  const removeItem = useCartStore((state) => state.removeItem);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const shipping = quoteShipping(subtotal, useShippingRules());

  // Toasts sit bottom-right on desktop, over the drawer footer CTAs: clear them when it opens.
  useEffect(() => {
    if (isOpen) toast.dismiss();
  }, [isOpen]);

  const empty = hydrated && cart.length === 0;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" closeLabel="Cerrar carrito">
        <SheetHeader>
          <SheetTitle>{hydrated && count > 0 ? `Carrito (${count})` : "Carrito"}</SheetTitle>
          {hydrated && count > 0 ? <SheetDescription>{pluralize(count, "producto")} en tu carrito</SheetDescription> : null}
        </SheetHeader>

        {!hydrated ? (
          <SheetBody className="flex items-center justify-center" aria-busy="true">
            <Spinner className="size-8 text-fg-muted" />
            <span className="sr-only">Cargando carrito…</span>
          </SheetBody>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {empty ? (
              <m.div key="empty" variants={fadeIn} initial="hidden" animate="visible" exit="exit" className="flex flex-1 items-center justify-center">
                <EmptyState
                  icon={<ShoppingCart />}
                  title="Tu carrito está vacío"
                  description="Agrega productos para comenzar. ¡Hay sets esperando ser construidos!"
                  action={
                    <Button onClick={onClose} render={<Link href="/" />}>
                      Explorar productos
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  }
                />
              </m.div>
            ) : (
              <m.div key="lines" variants={fadeIn} initial="hidden" animate="visible" exit="exit" className="flex min-h-0 flex-1 flex-col">
                <div className="border-b border-border px-4 py-3">
                  <FreeShippingProgress subtotal={subtotal} />
                </div>

                <SheetBody>
                  <ul className="space-y-3 p-4" aria-label="Productos en el carrito">
                    <AnimatePresence initial={false} mode="popLayout">
                      {cart.map((item) => (
                        <m.li
                          key={item.id}
                          layout
                          variants={dismissible}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          transition={{ layout: transitions.spring }}
                          className="flex gap-3 rounded-xl border border-border bg-bg-subtle p-3"
                          data-testid="cart-item"
                        >
                          <Link
                            href={`/item/${item.id}`}
                            onClick={onClose}
                            tabIndex={-1}
                            aria-hidden="true"
                            className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface"
                          >
                            <ProductImage src={item.image} alt="" fill sizes="80px" className="object-contain p-2" />
                          </Link>

                          <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="line-clamp-2 text-label font-medium text-fg">
                                <Link
                                  href={`/item/${item.id}`}
                                  onClick={onClose}
                                  className="rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
                                >
                                  {item.name}
                                </Link>
                              </h3>
                              <IconButton
                                label={`Eliminar ${item.name} del carrito`}
                                size="icon-sm"
                                onClick={() => removeItem(item.id)}
                                className="-mt-1 -mr-1 hover:text-danger"
                              >
                                <Trash2 aria-hidden="true" />
                              </IconButton>
                            </div>

                            <div className="mt-auto flex flex-wrap items-end justify-between gap-2">
                              <QuantitySelector
                                value={item.quantity}
                                onValueChange={(quantity) => setQuantity(item.id, quantity)}
                                max={item.stock}
                                size="sm"
                                label={`Cantidad de ${item.name}`}
                              />
                              <div className="text-right">
                                <Price value={item.price * item.quantity} size="sm" className="justify-end" />
                                {item.quantity > 1 ? (
                                  <p className="text-caption text-fg-muted tabular-nums">{formatPrice(item.price)} c/u</p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </m.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                </SheetBody>

                <SheetFooter className="gap-4">
                  <dl className="space-y-1.5 text-label font-normal">
                    <div className="flex justify-between text-fg-secondary">
                      <dt>Subtotal</dt>
                      <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
                    </div>
                    <div className="flex justify-between text-fg-secondary">
                      <dt>Envío</dt>
                      <dd className={shipping.free ? "font-semibold text-success" : "tabular-nums"}>
                        {shipping.free ? "Gratis" : formatPrice(shipping.cost)}
                      </dd>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 text-title text-fg">
                      <dt>Total</dt>
                      <dd className="tabular-nums" data-testid="cart-drawer-total">
                        {formatPrice(subtotal + shipping.cost)}
                      </dd>
                    </div>
                  </dl>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button variant="outline" className="w-full" render={<Link href="/cart" onClick={onClose} />}>
                      Ver carrito
                    </Button>
                    <Button className="w-full" data-testid="checkout-btn" render={<Link href="/checkout" onClick={onClose} />}>
                      Finalizar compra
                    </Button>
                  </div>
                </SheetFooter>
              </m.div>
            )}
          </AnimatePresence>
        )}
      </SheetContent>
    </Sheet>
  );
}
