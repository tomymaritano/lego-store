"use client";

import { useState, useEffect, useRef, use } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Heart, ShoppingCart, Star, Minus, Plus, Share2, Truck, Shield, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { products } from "@/data/products";
import { useCartStore, useWishlistStore, useRecentlyViewedStore } from "@/stores";
import { useHydration } from "@/hooks/useHydration";
import { formatPrice, calculateDiscount, cn } from "@/lib/utils";
import { Button, Badge, Breadcrumbs, showToast } from "@/components/ui";
import { ImageZoom, ProductReviews, RecentlyViewed } from "@/components/product";

interface ItemPageProps {
  params: Promise<{ productId: string }> | { productId: string };
}

export default function ItemPage({ params }: ItemPageProps) {
  // Handle both Promise and direct object params (Next.js 14.x compatibility)
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const { productId } = resolvedParams;
  const hydrated = useHydration();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  const product = products.find((p) => p.id === productId);

  const addItem = useCartStore((state) => state.addItem);
  const isInCart = useCartStore((state) => state.isInCart);
  const addToWishlist = useWishlistStore((state) => state.addToWishlist);
  const removeFromWishlist = useWishlistStore((state) => state.removeFromWishlist);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist);
  const addToRecentlyViewed = useRecentlyViewedStore((state) => state.addItem);
  const hasTrackedRef = useRef(false);

  // Track recently viewed - runs once per product
  useEffect(() => {
    if (product && !hasTrackedRef.current) {
      hasTrackedRef.current = true;
      addToRecentlyViewed(product);
    }
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!product) {
    notFound();
  }

  const inCart = hydrated && isInCart(product.id);
  const inWishlist = hydrated && isInWishlist(product.id);

  const handleAddToCart = () => {
    addItem(product, quantity);
    showToast.cart(`${quantity}x ${product.name} agregado al carrito`);
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

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Mira este set de LEGO: ${product.name}`,
          url: window.location.href,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      showToast.success("Enlace copiado al portapapeles");
    }
  };

  const breadcrumbItems = [
    { label: product.category, href: `/category/${product.category}` },
    { label: product.name },
  ];

  return (
    <>
      <div className="container-custom py-6">
        {/* Breadcrumbs */}
        <Breadcrumbs items={breadcrumbItems} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mt-4">
          {/* Images */}
          <div className="space-y-4">
            {/* Main Image with Zoom */}
            <motion.div
              key={selectedImage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative aspect-square bg-gradient-to-br from-background-secondary to-background-tertiary rounded-2xl overflow-hidden"
            >
              {/* Badges */}
              <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                {product.isNew && <Badge variant="new">Nuevo</Badge>}
                {product.isOnSale && product.originalPrice && (
                  <Badge variant="sale">-{calculateDiscount(product.originalPrice, product.price)}%</Badge>
                )}
              </div>

              <ImageZoom
                src={product.images[selectedImage] || product.img}
                alt={product.name}
                className="absolute inset-0"
              />
            </motion.div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {product.images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={cn(
                      "relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all bg-background-secondary",
                      selectedImage === index
                        ? "border-lego-yellow shadow-md"
                        : "border-transparent hover:border-border"
                    )}
                  >
                    <Image src={img} alt={`${product.name} ${index + 1}`} fill className="object-contain p-2" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Theme */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-lego-blue font-semibold uppercase tracking-wider">
                {product.theme}
              </span>
              <button
                onClick={handleShare}
                className="p-2 rounded-full hover:bg-background-secondary transition-colors"
                aria-label="Compartir"
              >
                <Share2 className="w-5 h-5 text-foreground-muted" />
              </button>
            </div>

            {/* Name */}
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground-primary">{product.name}</h1>

            {/* Rating */}
            <div className="flex items-center gap-3">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "w-5 h-5",
                      i < Math.floor(product.rating)
                        ? "fill-amber-400 text-amber-400"
                        : "fill-background-tertiary text-background-tertiary"
                    )}
                  />
                ))}
              </div>
              <span className="font-semibold text-foreground-primary">{product.rating}</span>
              <span className="text-foreground-muted">({Math.floor(product.rating * 20)} reseñas)</span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-foreground-primary">{formatPrice(product.price)}</span>
              {product.isOnSale && product.originalPrice && (
                <span className="text-xl text-foreground-muted line-through">{formatPrice(product.originalPrice)}</span>
              )}
            </div>

            {/* Description */}
            <p className="text-foreground-secondary leading-relaxed text-lg">{product.description}</p>

            {/* Stock Status */}
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "w-3 h-3 rounded-full animate-pulse",
                  product.stock > 0 ? "bg-status-success" : "bg-status-error"
                )}
              />
              <span className={cn("font-medium", product.stock > 0 ? "text-status-success" : "text-status-error")}>
                {product.stock > 0 ? `${product.stock} unidades disponibles` : "Agotado"}
              </span>
            </div>

            {/* Quantity Selector */}
            {product.stock > 0 && (
              <div className="flex items-center gap-4">
                <span className="text-foreground-secondary font-medium">Cantidad:</span>
                <div className="flex items-center gap-1 bg-background-secondary rounded-xl p-1">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface text-foreground-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center font-bold text-lg text-foreground-primary">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    disabled={quantity >= product.stock}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface text-foreground-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={handleAddToCart}
                disabled={product.stock === 0 || inCart}
                className="flex-1"
                size="lg"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                {inCart ? "En carrito" : "Agregar al carrito"}
              </Button>
              <Button
                variant={inWishlist ? "primary" : "outline"}
                size="lg"
                onClick={handleToggleWishlist}
                aria-label={inWishlist ? "Quitar de favoritos" : "Agregar a favoritos"}
                className={cn(inWishlist && "!bg-lego-red !text-white")}
              >
                <Heart className={cn("w-5 h-5", inWishlist && "fill-current")} />
              </Button>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="flex flex-col items-center text-center p-3 bg-background-secondary rounded-xl">
                <Truck className="w-6 h-6 text-lego-blue mb-2" />
                <span className="text-xs font-medium text-foreground-primary">Envío Gratis</span>
                <span className="text-xs text-foreground-muted">+$5,000</span>
              </div>
              <div className="flex flex-col items-center text-center p-3 bg-background-secondary rounded-xl">
                <Shield className="w-6 h-6 text-lego-blue mb-2" />
                <span className="text-xs font-medium text-foreground-primary">Garantía</span>
                <span className="text-xs text-foreground-muted">Original</span>
              </div>
              <div className="flex flex-col items-center text-center p-3 bg-background-secondary rounded-xl">
                <RotateCcw className="w-6 h-6 text-lego-blue mb-2" />
                <span className="text-xs font-medium text-foreground-primary">Devolución</span>
                <span className="text-xs text-foreground-muted">30 días</span>
              </div>
            </div>

            {/* Product Details */}
            <div className="border-t border-border pt-6 space-y-4">
              <h3 className="font-bold text-lg text-foreground-primary">Especificaciones</h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <dt className="text-foreground-muted">Categoría</dt>
                  <dd className="font-medium text-foreground-primary capitalize">{product.category}</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <dt className="text-foreground-muted">Tema</dt>
                  <dd className="font-medium text-foreground-primary">{product.theme}</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <dt className="text-foreground-muted">Edad</dt>
                  <dd className="font-medium text-foreground-primary">{product.age}</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <dt className="text-foreground-muted">Piezas</dt>
                  <dd className="font-medium text-foreground-primary">{product.pieces?.toLocaleString() || "N/A"}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <ProductReviews productId={product.id} />

      {/* Recently Viewed */}
      <RecentlyViewed />
    </>
  );
}
