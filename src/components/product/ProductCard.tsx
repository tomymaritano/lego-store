"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, ShoppingCart, Star, Eye, Scale } from "lucide-react";
import type { Product } from "@/types";
import { useCartStore, useWishlistStore, useCompareStore } from "@/stores";
import { useHydration } from "@/hooks/useHydration";
import { formatPrice, calculateDiscount, cn } from "@/lib/utils";
import { Button, showToast } from "@/components/ui";

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
}

export function ProductCard({ product, onQuickView }: ProductCardProps) {
  const hydrated = useHydration();
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const addItem = useCartStore((state) => state.addItem);
  const isInCart = useCartStore((state) => state.isInCart);
  const addToWishlist = useWishlistStore((state) => state.addToWishlist);
  const removeFromWishlist = useWishlistStore((state) => state.removeFromWishlist);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist);
  const { addToCompare, removeFromCompare, isInCompare, canAddMore } = useCompareStore();

  const inCart = hydrated && isInCart(product.id);
  const inWishlist = hydrated && isInWishlist(product.id);
  const inCompare = hydrated && isInCompare(product.id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1);
    showToast.cart(`${product.name} agregado al carrito`);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inWishlist) {
      removeFromWishlist(product.id);
      showToast.wishlist("Eliminado de favoritos", false);
    } else {
      addToWishlist(product);
      showToast.wishlist("Agregado a favoritos", true);
    }
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onQuickView?.(product);
  };

  const handleToggleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inCompare) {
      removeFromCompare(product.id);
      showToast.success("Eliminado de comparación");
    } else {
      if (!canAddMore()) {
        showToast.error("Máximo 4 productos para comparar");
        return;
      }
      const added = addToCompare(product);
      if (added) {
        showToast.success("Agregado a comparación");
      }
    }
  };

  const displayImage = isHovered && product.imageSecondary ? product.imageSecondary : product.img;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="h-full"
      data-testid="product-card"
    >
      <Link href={`/item/${product.id}`}>
        <div className="group bg-surface rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 h-full flex flex-col border border-border">
          {/* Image Container */}
          <div className="relative aspect-square bg-gradient-to-br from-background-secondary to-background-tertiary overflow-hidden">
            {/* Badges */}
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
              {product.isNew && (
                <span className="bg-lego-blue text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                  Nuevo
                </span>
              )}
              {product.isOnSale && product.originalPrice && (
                <span className="bg-lego-red text-white text-[10px] font-bold px-2 py-1 rounded-full">
                  -{calculateDiscount(product.originalPrice, product.price)}%
                </span>
              )}
              {product.highlight === "Edición Limitada" && (
                <span className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                  Limitado
                </span>
              )}
              {product.highlight === "Exclusivos" && (
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                  Exclusivo
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className={cn(
              "absolute top-3 right-3 z-10 flex flex-col gap-2 transition-all duration-300",
              isHovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
            )}>
              <button
                onClick={handleToggleWishlist}
                className={cn(
                  "p-2.5 rounded-full transition-all shadow-lg",
                  inWishlist
                    ? "bg-lego-red text-white"
                    : "bg-surface text-foreground-secondary hover:text-lego-red hover:bg-red-50 dark:hover:bg-red-950"
                )}
                aria-label={inWishlist ? "Quitar de favoritos" : "Agregar a favoritos"}
              >
                <Heart className={cn("w-4 h-4", inWishlist && "fill-current")} />
              </button>
              <button
                onClick={handleQuickView}
                className="p-2.5 rounded-full bg-surface text-foreground-secondary hover:text-lego-blue hover:bg-blue-50 dark:hover:bg-blue-950 transition-all shadow-lg"
                aria-label="Vista rápida"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={handleToggleCompare}
                className={cn(
                  "p-2.5 rounded-full transition-all shadow-lg",
                  inCompare
                    ? "bg-lego-blue text-white"
                    : "bg-surface text-foreground-secondary hover:text-lego-blue hover:bg-blue-50 dark:hover:bg-blue-950"
                )}
                aria-label={inCompare ? "Quitar de comparación" : "Agregar a comparación"}
              >
                <Scale className="w-4 h-4" />
              </button>
            </div>

            {/* Product Image */}
            <div className="relative w-full h-full p-6">
              <Image
                src={imageError ? "/images/placeholder.png" : displayImage}
                alt={product.name}
                fill
                className={cn(
                  "object-contain transition-all duration-500",
                  isHovered ? "scale-110" : "scale-100"
                )}
                onError={() => setImageError(true)}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>

            {/* Quick Add Button - Shows on Hover */}
            <motion.div
              initial={false}
              animate={{ y: isHovered ? 0 : 100, opacity: isHovered ? 1 : 0 }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-0 left-0 right-0 p-3"
            >
              <Button
                onClick={handleAddToCart}
                disabled={product.stock === 0 || inCart}
                className="w-full shadow-lg"
                size="sm"
                data-testid="add-to-cart-btn"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                {inCart ? "En carrito" : product.stock === 0 ? "Agotado" : "Agregar al carrito"}
              </Button>
            </motion.div>

            {/* Out of Stock Overlay */}
            {product.stock === 0 && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                <span className="bg-surface text-foreground-primary px-4 py-2 rounded-full font-bold text-sm shadow-lg">
                  Agotado
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4 flex-1 flex flex-col">
            {/* Theme Tag */}
            <span className="text-[10px] text-lego-blue font-semibold uppercase tracking-wider">
              {product.theme}
            </span>

            {/* Name */}
            <h3 className="font-bold text-foreground-primary mt-1 line-clamp-2 group-hover:text-lego-blue transition-colors leading-tight" data-testid="product-name">
              {product.name}
            </h3>

            {/* Rating */}
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "w-3.5 h-3.5",
                      i < Math.floor(product.rating)
                        ? "fill-amber-400 text-amber-400"
                        : "fill-background-tertiary text-background-tertiary"
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-foreground-muted">
                ({Math.floor(product.rating * 20)})
              </span>
            </div>

            {/* Price */}
            <div className="mt-auto pt-3 flex items-end justify-between">
              <div>
                <span className="text-2xl font-bold text-foreground-primary" data-testid="product-price">
                  {formatPrice(product.price)}
                </span>
                {product.isOnSale && product.originalPrice && (
                  <span className="text-sm text-foreground-muted line-through ml-2">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
              </div>

              {/* Stock indicator */}
              {product.stock > 0 && product.stock <= 5 && (
                <span className="text-[10px] text-status-warning font-medium">
                  ¡Solo {product.stock}!
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
