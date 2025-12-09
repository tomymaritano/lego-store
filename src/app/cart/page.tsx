"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2, ChevronLeft, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "@/stores";
import { useHydration } from "@/hooks/useHydration";
import { formatPrice } from "@/lib/utils";
import { Button, QuantitySelector, Skeleton } from "@/components/ui";

export default function CartPage() {
  const hydrated = useHydration();
  const cart = useCartStore((state) => state.cart);
  const removeItem = useCartStore((state) => state.removeItem);
  const increaseQuantity = useCartStore((state) => state.increaseQuantity);
  const decreaseQuantity = useCartStore((state) => state.decreaseQuantity);
  const clearCart = useCartStore((state) => state.clearCart);
  const getTotalPrice = useCartStore((state) => state.getTotalPrice);
  const getTotalQuantity = useCartStore((state) => state.getTotalQuantity);

  if (!hydrated) {
    return (
      <div className="container-custom py-8">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
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
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 bg-background-secondary rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-12 h-12 text-foreground-muted" />
          </div>
          <h1 className="text-2xl font-bold mb-4 text-foreground-primary">Tu carrito está vacío</h1>
          <p className="text-foreground-muted mb-8">
            Parece que aún no has agregado productos a tu carrito. ¡Explora nuestra tienda!
          </p>
          <Link href="/">
            <Button size="lg">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Explorar productos
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-custom py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground-primary">Carrito de compras</h1>
          <p className="text-foreground-muted mt-1">{getTotalQuantity()} productos</p>
        </div>
        <Button variant="ghost" onClick={clearCart}>
          Vaciar carrito
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence mode="popLayout">
            {cart.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="bg-surface rounded-xl p-4 shadow-card flex gap-4 border border-border"
              >
                {/* Image */}
                <Link href={`/item/${item.id}`} className="flex-shrink-0">
                  <div className="relative w-24 h-24 bg-background-secondary rounded-lg overflow-hidden">
                    <Image src={item.image} alt={item.name} fill className="object-contain p-2" />
                  </div>
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link href={`/item/${item.id}`} className="hover:text-lego-blue transition-colors">
                    <h3 className="font-semibold truncate text-foreground-primary">{item.name}</h3>
                  </Link>
                  <p className="text-lg font-bold text-foreground-primary mt-1">{formatPrice(item.price)}</p>

                  <div className="flex items-center justify-between mt-3">
                    <QuantitySelector
                      quantity={item.quantity}
                      onIncrease={() => increaseQuantity(item.id)}
                      onDecrease={() => decreaseQuantity(item.id)}
                      max={item.stock}
                      size="sm"
                    />

                    <div className="flex items-center gap-4">
                      <span className="text-foreground-muted text-sm">
                        Subtotal: {formatPrice(item.price * item.quantity)}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-foreground-muted hover:text-lego-red transition-colors"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-surface rounded-xl p-6 shadow-card sticky top-24 border border-border">
            <h2 className="text-xl font-bold mb-4 text-foreground-primary">Resumen del pedido</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground-muted">Subtotal ({getTotalQuantity()} productos)</span>
                <span className="text-foreground-primary">{formatPrice(getTotalPrice())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Envío</span>
                <span className="text-status-success">Gratis</span>
              </div>
            </div>

            <div className="border-t border-border mt-4 pt-4">
              <div className="flex justify-between text-lg font-bold">
                <span className="text-foreground-primary">Total</span>
                <span className="text-foreground-primary">{formatPrice(getTotalPrice())}</span>
              </div>
            </div>

            <Button className="w-full mt-6" size="lg">
              Finalizar compra
            </Button>

            <Link href="/" className="block mt-4">
              <Button variant="outline" className="w-full">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Seguir comprando
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
