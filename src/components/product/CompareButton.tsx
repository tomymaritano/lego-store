"use client";

import Image from "next/image";
import { Scale } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCompareStore } from "@/stores/compareStore";
import { useHydration } from "@/hooks/useHydration";
import { showToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

interface CompareButtonProps {
  product: Product;
  size?: "sm" | "md";
  className?: string;
}

export function CompareButton({ product, size = "md", className }: CompareButtonProps) {
  const hydrated = useHydration();
  const { addToCompare, removeFromCompare, isInCompare, canAddMore } = useCompareStore();

  const inCompare = hydrated && isInCompare(product.id);

  const handleToggle = (e: React.MouseEvent) => {
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

  const sizeClasses = {
    sm: "p-2",
    md: "p-2.5",
  };

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "rounded-full transition-all",
        sizeClasses[size],
        inCompare
          ? "bg-lego-blue text-white"
          : "bg-white text-gray-600 hover:text-lego-blue hover:bg-blue-50 shadow-lg",
        className
      )}
      aria-label={inCompare ? "Quitar de comparación" : "Agregar a comparación"}
    >
      <Scale className={cn("w-4 h-4", size === "sm" && "w-3.5 h-3.5")} />
    </button>
  );
}

// Floating Compare Bar
export function CompareBar() {
  const hydrated = useHydration();
  const { items, clearCompare } = useCompareStore();

  if (!hydrated || items.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
      >
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border p-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-lego-blue" />
            <span className="font-semibold">{items.length} productos</span>
          </div>

          <div className="flex -space-x-2">
            {items.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="relative w-10 h-10 rounded-full bg-gray-100 border-2 border-white overflow-hidden"
              >
                <Image src={item.img} alt={item.name} fill className="object-contain p-1" />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <a
              href="/compare"
              className="px-4 py-2 bg-lego-blue text-white rounded-xl font-medium text-sm hover:bg-blue-600 transition-colors"
            >
              Comparar
            </a>
            <button
              onClick={clearCompare}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
            >
              Limpiar
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
