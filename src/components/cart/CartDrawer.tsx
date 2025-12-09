"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useCartStore } from "@/stores";
import { useHydration } from "@/hooks/useHydration";
import { formatPrice } from "@/lib/utils";
import { Button, Drawer, QuantitySelector } from "@/components/ui";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const hydrated = useHydration();
  const cart = useCartStore((state) => state.cart);
  const removeItem = useCartStore((state) => state.removeItem);
  const increaseQuantity = useCartStore((state) => state.increaseQuantity);
  const decreaseQuantity = useCartStore((state) => state.decreaseQuantity);
  const getTotalPrice = useCartStore((state) => state.getTotalPrice);

  if (!hydrated) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} title="Carrito">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lego-yellow" />
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={`Carrito (${cart.length})`}>
      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="w-24 h-24 bg-background-secondary rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl">🛒</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground-primary mb-2">Tu carrito está vacío</h3>
          <p className="text-foreground-muted mb-6">Agrega productos para comenzar</p>
          <Button onClick={onClose}>Explorar productos</Button>
        </div>
      ) : (
        <>
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.map((item) => (
              <div key={item.id} className="flex gap-4 p-3 bg-background-secondary rounded-lg" data-testid="cart-item">
                <div className="relative w-20 h-20 bg-surface rounded-lg overflow-hidden flex-shrink-0">
                  <Image src={item.image} alt={item.name} fill className="object-contain p-2" />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate text-foreground-primary">{item.name}</h4>
                  <p className="text-foreground-primary font-bold mt-1">{formatPrice(item.price)}</p>

                  <div className="flex items-center justify-between mt-2">
                    <QuantitySelector
                      quantity={item.quantity}
                      onIncrease={() => increaseQuantity(item.id)}
                      onDecrease={() => decreaseQuantity(item.id)}
                      max={item.stock}
                      size="sm"
                    />

                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-foreground-muted hover:text-lego-red transition-colors"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-border p-4 space-y-4">
            <div className="flex justify-between text-lg font-semibold text-foreground-primary">
              <span>Total</span>
              <span>{formatPrice(getTotalPrice())}</span>
            </div>

            <div className="space-y-2">
              <Link href="/cart" onClick={onClose}>
                <Button variant="outline" className="w-full">
                  Ver carrito
                </Button>
              </Link>
              <Button className="w-full" data-testid="checkout-btn">Finalizar compra</Button>
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}
