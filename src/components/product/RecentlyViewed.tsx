"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useRecentlyViewedStore } from "@/stores/recentlyViewedStore";
import { useHydration } from "@/hooks/useHydration";
import { formatPrice } from "@/lib/utils";

export function RecentlyViewed() {
  const hydrated = useHydration();
  const items = useRecentlyViewedStore((state) => state.items);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!hydrated || items.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 280;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="py-12 bg-gray-50">
      <div className="container-custom">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-lego-blue/10 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-lego-blue" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Vistos Recientemente</h2>
              <p className="text-sm text-gray-500">Continúa donde lo dejaste</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => scroll("left")}
              className="p-2 rounded-full bg-white border hover:bg-gray-100 transition-colors"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="p-2 rounded-full bg-white border hover:bg-gray-100 transition-colors"
              aria-label="Siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4"
        >
          {items.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex-shrink-0 w-48"
            >
              <Link href={`/item/${product.id}`}>
                <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                  <div className="relative aspect-square bg-gray-50">
                    <Image
                      src={product.img}
                      alt={product.name}
                      fill
                      className="object-contain p-3 group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-lego-blue font-semibold uppercase">
                      {product.theme}
                    </p>
                    <h3 className="font-medium text-sm text-gray-900 line-clamp-1 mt-1">
                      {product.name}
                    </h3>
                    <p className="font-bold text-gray-900 mt-1">
                      {formatPrice(product.price)}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
