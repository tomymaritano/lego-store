"use client";

import Image from "next/image";
import Link from "next/link";
import { Scale, X, ShoppingCart, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useCompareStore } from "@/stores/compareStore";
import { useCartStore } from "@/stores";
import { useHydration } from "@/hooks/useHydration";
import { formatPrice, cn } from "@/lib/utils";
import { Button, Skeleton, showToast } from "@/components/ui";
import { PageTransition } from "@/components/layout";

export default function ComparePage() {
  const hydrated = useHydration();
  const { items, removeFromCompare, clearCompare } = useCompareStore();
  const addToCart = useCartStore((state) => state.addItem);

  if (!hydrated) {
    return (
      <div className="container-custom py-8">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <PageTransition>
        <div className="container-custom py-16">
          <div className="max-w-md mx-auto text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Scale className="w-12 h-12 text-gray-400" />
            </div>
            <h1 className="text-2xl font-bold mb-4">No hay productos para comparar</h1>
            <p className="text-gray-500 mb-8">
              Agrega productos a la comparación para ver sus características lado a lado.
            </p>
            <Link href="/">
              <Button size="lg">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Explorar productos
              </Button>
            </Link>
          </div>
        </div>
      </PageTransition>
    );
  }

  const handleAddToCart = (item: typeof items[0]) => {
    addToCart(item, 1);
    showToast.cart(`${item.name} agregado al carrito`);
  };

  const specs = [
    { key: "category", label: "Categoría" },
    { key: "theme", label: "Tema" },
    { key: "pieces", label: "Piezas" },
    { key: "age", label: "Edad" },
    { key: "rating", label: "Calificación" },
    { key: "stock", label: "Disponibilidad" },
  ];

  return (
    <PageTransition>
      <div className="container-custom py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Comparar Productos</h1>
            <p className="text-gray-500">{items.length} de 4 productos máximo</p>
          </div>
          <Button variant="outline" onClick={clearCompare}>
            Limpiar todo
          </Button>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            {/* Product Images & Names */}
            <thead>
              <tr>
                <th className="w-48 p-4 text-left text-sm font-medium text-gray-500 border-b">
                  Producto
                </th>
                {items.map((item) => (
                  <th key={item.id} className="p-4 border-b">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative"
                    >
                      <button
                        onClick={() => removeFromCompare(item.id)}
                        className="absolute -top-2 -right-2 p-1 bg-gray-100 hover:bg-gray-200 rounded-full z-10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <Link href={`/item/${item.id}`}>
                        <div className="relative w-32 h-32 mx-auto bg-gray-50 rounded-xl mb-3">
                          <Image
                            src={item.img}
                            alt={item.name}
                            fill
                            className="object-contain p-2"
                          />
                        </div>
                        <h3 className="font-semibold text-sm line-clamp-2 hover:text-lego-blue transition-colors">
                          {item.name}
                        </h3>
                      </Link>
                    </motion.div>
                  </th>
                ))}
                {/* Empty slots */}
                {[...Array(4 - items.length)].map((_, i) => (
                  <th key={`empty-${i}`} className="p-4 border-b">
                    <Link href="/">
                      <div className="w-32 h-32 mx-auto bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center">
                        <span className="text-gray-400 text-sm text-center px-2">
                          + Agregar producto
                        </span>
                      </div>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Price Row */}
              <tr className="bg-gray-50 dark:bg-gray-800">
                <td className="p-4 font-medium text-sm">Precio</td>
                {items.map((item) => (
                  <td key={item.id} className="p-4 text-center">
                    <span className="text-xl font-bold text-lego-red">
                      {formatPrice(item.price)}
                    </span>
                    {item.originalPrice && (
                      <span className="block text-sm text-gray-400 line-through">
                        {formatPrice(item.originalPrice)}
                      </span>
                    )}
                  </td>
                ))}
                {[...Array(4 - items.length)].map((_, i) => (
                  <td key={`empty-price-${i}`} className="p-4" />
                ))}
              </tr>

              {/* Specs Rows */}
              {specs.map((spec, idx) => (
                <tr key={spec.key} className={idx % 2 === 0 ? "" : "bg-gray-50 dark:bg-gray-800"}>
                  <td className="p-4 font-medium text-sm capitalize">{spec.label}</td>
                  {items.map((item) => {
                    const value = item[spec.key as keyof typeof item];
                    return (
                      <td key={item.id} className="p-4 text-center text-sm">
                        {spec.key === "rating" ? (
                          <span className="flex items-center justify-center gap-1">
                            <span className="text-amber-500">★</span>
                            {value}
                          </span>
                        ) : spec.key === "stock" ? (
                          <span
                            className={cn(
                              "px-2 py-1 rounded-full text-xs font-medium",
                              Number(value) > 0
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            )}
                          >
                            {Number(value) > 0 ? `${value} disponibles` : "Agotado"}
                          </span>
                        ) : spec.key === "pieces" ? (
                          value?.toLocaleString() || "N/A"
                        ) : (
                          String(value || "N/A")
                        )}
                      </td>
                    );
                  })}
                  {[...Array(4 - items.length)].map((_, i) => (
                    <td key={`empty-${spec.key}-${i}`} className="p-4" />
                  ))}
                </tr>
              ))}

              {/* Actions Row */}
              <tr className="border-t">
                <td className="p-4 font-medium text-sm">Acciones</td>
                {items.map((item) => (
                  <td key={item.id} className="p-4 text-center">
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => handleAddToCart(item)}
                        disabled={item.stock === 0}
                        size="sm"
                        className="w-full"
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Agregar
                      </Button>
                      <Link href={`/item/${item.id}`}>
                        <Button variant="outline" size="sm" className="w-full">
                          Ver detalles
                        </Button>
                      </Link>
                    </div>
                  </td>
                ))}
                {[...Array(4 - items.length)].map((_, i) => (
                  <td key={`empty-action-${i}`} className="p-4" />
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </PageTransition>
  );
}
