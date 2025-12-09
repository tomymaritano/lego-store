"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, ShoppingCart, Star, Plus, Minus, ExternalLink } from "lucide-react";
import type { Product } from "@/types";
import { useCartStore, useWishlistStore } from "@/stores";
import { useHydration } from "@/hooks/useHydration";
import { formatPrice, calculateDiscount, cn } from "@/lib/utils";
import { Button } from "./Button";
import { showToast } from "./Toast";

interface QuickViewModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export function QuickViewModal({ product, isOpen, onClose }: QuickViewModalProps) {
  const hydrated = useHydration();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  const addItem = useCartStore((state) => state.addItem);
  const isInCart = useCartStore((state) => state.isInCart);
  const addToWishlist = useWishlistStore((state) => state.addToWishlist);
  const removeFromWishlist = useWishlistStore((state) => state.removeFromWishlist);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist);

  if (!product) return null;

  const inCart = hydrated && isInCart(product.id);
  const inWishlist = hydrated && isInWishlist(product.id);

  const images = [product.img, product.imageSecondary].filter(Boolean) as string[];

  const handleAddToCart = () => {
    addItem(product, quantity);
    showToast.cart(`${product.name} agregado al carrito`);
    setQuantity(1);
  };

  const handleToggleWishlist = () => {
    if (inWishlist) {
      removeFromWishlist(product.id);
      showToast.wishlist("Eliminado de favoritos", false);
    } else {
      addToWishlist(product);
      showToast.wishlist("Agregado a favoritos", true);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-4xl md:max-h-[90vh] bg-surface rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-surface hover:bg-background-secondary transition-colors shadow-md text-foreground-primary"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col md:flex-row overflow-auto">
              {/* Image Section */}
              <div className="md:w-1/2 bg-background-secondary p-6">
                <div className="relative aspect-square rounded-xl overflow-hidden bg-surface">
                  <Image
                    src={images[selectedImage] || product.img}
                    alt={product.name}
                    fill
                    className="object-contain p-4"
                  />
                  {product.isOnSale && product.originalPrice && (
                    <span className="absolute top-3 left-3 bg-lego-red text-white text-xs font-bold px-2 py-1 rounded-full">
                      -{calculateDiscount(product.originalPrice, product.price)}%
                    </span>
                  )}
                </div>

                {/* Thumbnails */}
                {images.length > 1 && (
                  <div className="flex gap-2 mt-4 justify-center">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImage(idx)}
                        className={cn(
                          "w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                          selectedImage === idx ? "border-lego-yellow" : "border-transparent"
                        )}
                      >
                        <Image
                          src={img}
                          alt={`${product.name} ${idx + 1}`}
                          width={64}
                          height={64}
                          className="object-contain"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Info Section */}
              <div className="md:w-1/2 p-6 flex flex-col">
                {/* Theme */}
                <span className="text-xs font-semibold text-lego-blue uppercase tracking-wider">
                  {product.theme}
                </span>

                {/* Name */}
                <h2 className="text-2xl font-bold text-foreground-primary mt-2">{product.name}</h2>

                {/* Rating */}
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "w-4 h-4",
                          i < Math.floor(product.rating)
                            ? "fill-amber-400 text-amber-400"
                            : "fill-background-tertiary text-background-tertiary"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-foreground-muted">
                    {product.rating} ({Math.floor(product.rating * 20)} reseñas)
                  </span>
                </div>

                {/* Price */}
                <div className="mt-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-foreground-primary">
                      {formatPrice(product.price)}
                    </span>
                    {product.isOnSale && product.originalPrice && (
                      <span className="text-lg text-foreground-muted line-through">
                        {formatPrice(product.originalPrice)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {product.description && (
                  <p className="text-foreground-secondary mt-4 text-sm line-clamp-3">
                    {product.description}
                  </p>
                )}

                {/* Details */}
                <div className="mt-4 space-y-2 text-sm">
                  {product.pieces && (
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-foreground-muted">Piezas</span>
                      <span className="font-medium text-foreground-primary">{product.pieces.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-foreground-muted">Categoría</span>
                    <span className="font-medium text-foreground-primary capitalize">{product.category}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-foreground-muted">Disponibilidad</span>
                    <span className={cn("font-medium", product.stock > 0 ? "text-status-success" : "text-status-error")}>
                      {product.stock > 0 ? `${product.stock} en stock` : "Agotado"}
                    </span>
                  </div>
                </div>

                {/* Quantity */}
                <div className="mt-6">
                  <label className="text-sm font-medium text-foreground-secondary mb-2 block">
                    Cantidad
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-10 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-background-secondary transition-colors text-foreground-primary"
                      disabled={quantity <= 1}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center font-bold text-lg text-foreground-primary">{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                      className="w-10 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-background-secondary transition-colors text-foreground-primary"
                      disabled={quantity >= product.stock}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 space-y-3">
                  <Button
                    onClick={handleAddToCart}
                    disabled={product.stock === 0 || inCart}
                    className="w-full"
                    size="lg"
                  >
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    {inCart ? "Ya en el carrito" : "Agregar al carrito"}
                  </Button>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={handleToggleWishlist}
                      className={cn("flex-1", inWishlist && "!border-lego-red !text-lego-red")}
                    >
                      <Heart className={cn("w-5 h-5 mr-2", inWishlist && "fill-current")} />
                      {inWishlist ? "En favoritos" : "Favoritos"}
                    </Button>

                    <Link href={`/item/${product.id}`} className="flex-1">
                      <Button variant="ghost" className="w-full" onClick={onClose}>
                        <ExternalLink className="w-5 h-5 mr-2" />
                        Ver detalles
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
