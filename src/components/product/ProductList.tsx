"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Loader2 } from "lucide-react";
import type { Product } from "@/types";
import { ProductCard } from "./ProductCard";
import { ProductListSkeleton, QuickViewModal, Button } from "@/components/ui";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

interface ProductListProps {
  products: Product[];
  isLoading?: boolean;
  columns?: 3 | 4;
  enableInfiniteScroll?: boolean;
  itemsPerPage?: number;
}

export function ProductList({
  products,
  isLoading,
  columns = 4,
  enableInfiniteScroll = true,
  itemsPerPage = 8,
}: ProductListProps) {
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const {
    displayedItems,
    hasMore,
    isLoading: isLoadingMore,
    loadMore,
    sentinelRef,
  } = useInfiniteScroll({
    items: products,
    itemsPerPage,
  });

  const displayProducts = enableInfiniteScroll ? displayedItems : products;

  if (isLoading) {
    return <ProductListSkeleton count={8} />;
  }

  if (products.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Package className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">No se encontraron productos</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Intenta ajustar los filtros o buscar algo diferente.
          Tenemos muchos sets increíbles esperándote.
        </p>
      </motion.div>
    );
  }

  const gridCols = columns === 3
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`grid ${gridCols} gap-6`}
      >
        <AnimatePresence mode="popLayout">
          {displayProducts.map((product, index) => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: Math.min(index * 0.03, 0.3) }}
            >
              <ProductCard
                product={product}
                onQuickView={setQuickViewProduct}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Infinite Scroll */}
      {enableInfiniteScroll && (
        <div className="mt-8">
          {/* Sentinel Element */}
          <div ref={sentinelRef} className="h-4" />

          {/* Loading State */}
          {isLoadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-8 h-8 animate-spin text-lego-blue" />
            </div>
          )}

          {/* Load More Button (fallback) */}
          {hasMore && !isLoadingMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore}>
                Cargar más productos
              </Button>
            </div>
          )}

          {/* End Message */}
          {!hasMore && displayProducts.length > 0 && (
            <p className="text-center text-gray-500 py-4">
              Has visto todos los {products.length} productos
            </p>
          )}
        </div>
      )}

      {/* Quick View Modal */}
      <QuickViewModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
    </>
  );
}
