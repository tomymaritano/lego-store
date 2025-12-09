"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingCart, Trash2, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWishlistStore, useCartStore } from "@/stores";
import { useHydration } from "@/hooks/useHydration";
import { formatPrice } from "@/lib/utils";
import { products } from "@/data/products";
import { Button, Skeleton } from "@/components/ui";

export default function WishlistPage() {
  const hydrated = useHydration();
  const wishlist = useWishlistStore((state) => state.wishlist);
  const removeFromWishlist = useWishlistStore((state) => state.removeFromWishlist);
  const clearWishlist = useWishlistStore((state) => state.clearWishlist);

  const addItem = useCartStore((state) => state.addItem);
  const isInCart = useCartStore((state) => state.isInCart);

  if (!hydrated) {
    return (
      <div className="container-custom py-8">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (wishlist.length === 0) {
    return (
      <div className="container-custom py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 bg-background-secondary rounded-full flex items-center justify-center mx-auto mb-6">
            <Heart className="w-12 h-12 text-foreground-muted" />
          </div>
          <h1 className="text-2xl font-bold mb-4 text-foreground-primary">Tu lista de deseos está vacía</h1>
          <p className="text-foreground-muted mb-8">
            Guarda tus productos favoritos para comprarlos más tarde.
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

  const handleAddToCart = (item: (typeof wishlist)[0]) => {
    const product = products.find((p) => p.id === item.id);
    if (product) {
      addItem(product, 1);
    }
  };

  return (
    <div className="container-custom py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground-primary">Lista de deseos</h1>
          <p className="text-foreground-muted mt-1">{wishlist.length} productos guardados</p>
        </div>
        <Button variant="ghost" onClick={clearWishlist}>
          Vaciar lista
        </Button>
      </div>

      {/* Wishlist Items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {wishlist.map((item) => {
            const inCart = isInCart(item.id);

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-surface rounded-xl shadow-card overflow-hidden border border-border"
              >
                {/* Image */}
                <Link href={`/item/${item.id}`} className="block relative aspect-square bg-background-secondary">
                  <Image src={item.image} alt={item.name} fill className="object-contain p-4" />
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      removeFromWishlist(item.id);
                    }}
                    className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-sm rounded-full text-lego-red hover:bg-white transition-colors"
                    aria-label="Quitar de favoritos"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Link>

                {/* Info */}
                <div className="p-4">
                  <Link href={`/item/${item.id}`} className="hover:text-lego-blue transition-colors">
                    <h3 className="font-semibold line-clamp-2 text-foreground-primary">{item.name}</h3>
                  </Link>

                  <p className="text-xl font-bold text-foreground-primary mt-2">{formatPrice(item.price)}</p>

                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => handleAddToCart(item)}
                      disabled={item.stock === 0 || inCart}
                      className="flex-1"
                      size="sm"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {inCart ? "En carrito" : "Agregar"}
                    </Button>
                  </div>

                  {item.stock === 0 && (
                    <p className="text-sm text-status-error mt-2 text-center">Producto agotado</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
