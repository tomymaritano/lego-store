"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ShoppingCart, Trash2 } from "lucide-react";
import { useCartItems, useCartStore, useCartSubtotal, useStoreHydrated } from "@/stores";
import { formatPrice } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import {
  Button,
  EmptyState,
  IconButton,
  QuantitySelector,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Spinner,
} from "@/components/ui";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const hydrated = useStoreHydrated(useCartStore);
  const cart = useCartItems();
  const totalPrice = useCartSubtotal();
  const removeItem = useCartStore((state) => state.removeItem);
  const setQuantity = useCartStore((state) => state.setQuantity);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{hydrated ? `Carrito (${cart.length})` : "Carrito"}</SheetTitle>
        </SheetHeader>

        {!hydrated ? (
          <SheetBody className="flex items-center justify-center" aria-busy="true">
            <Spinner className="size-8 text-fg-muted" />
            <span className="sr-only">Cargando carrito…</span>
          </SheetBody>
        ) : cart.length === 0 ? (
          <SheetBody className="flex items-center justify-center">
            <EmptyState
              icon={<ShoppingCart />}
              title="Tu carrito está vacío"
              description="Agrega productos para comenzar"
              action={<Button onClick={onClose}>Explorar productos</Button>}
            />
          </SheetBody>
        ) : (
          <>
            <SheetBody>
              <ul className="space-y-3 p-4">
                <AnimatePresence initial={false}>
                  {cart.map((item) => (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 24 }}
                      transition={transitions.spring}
                      className="flex gap-4 rounded-xl bg-bg-subtle p-3"
                      data-testid="cart-item"
                    >
                      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface">
                        <Image src={item.image} alt="" fill className="object-contain p-2" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-medium text-fg">{item.name}</h3>
                        <p className="mt-1 font-bold text-fg">{formatPrice(item.price)}</p>

                        <div className="mt-2 flex items-center justify-between">
                          <QuantitySelector
                            value={item.quantity}
                            onValueChange={(quantity) => setQuantity(item.id, quantity)}
                            max={item.stock}
                            size="sm"
                            label={`Cantidad de ${item.name}`}
                          />
                          <IconButton
                            label={`Eliminar ${item.name} del carrito`}
                            size="icon-sm"
                            onClick={() => removeItem(item.id)}
                            className="hover:text-danger"
                          >
                            <Trash2 aria-hidden="true" />
                          </IconButton>
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </SheetBody>

            <SheetFooter className="gap-4">
              <div className="flex justify-between text-lg font-semibold text-fg">
                <span>Total</span>
                <span className="tabular-nums">{formatPrice(totalPrice)}</span>
              </div>

              <div className="flex flex-col gap-2">
                <Button variant="outline" className="w-full" render={<Link href="/cart" onClick={onClose} />}>
                  Ver carrito
                </Button>
                <Button className="w-full" data-testid="checkout-btn" render={<Link href="/checkout" onClick={onClose} />}>
                  Finalizar compra
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
