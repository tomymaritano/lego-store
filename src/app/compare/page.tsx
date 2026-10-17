"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ChevronLeft, Plus, Scale, X } from "lucide-react";
import { fadeInUp } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { MAX_COMPARE_ITEMS, useCompareIds, useCompareStore, useStoreHydrated } from "@/stores";
import { useProductActions } from "@/hooks/useProductActions";
import { useProductsByIds } from "@/hooks/useProductsByIds";
import { Badge, Button, EmptyState, IconButton, Price, Rating, Skeleton } from "@/components/ui";
import { PageTransition } from "@/components/layout";
import { AddToCartButton, ProductImage } from "@/components/product";
import { CategoryName } from "@/providers/CategoriesProvider";
import type { Product } from "@/types";

const specs: { label: string; render: (p: Product) => React.ReactNode }[] = [
  { label: "Categoría", render: (p) => <CategoryName id={p.category} /> },
  { label: "Tema", render: (p) => p.theme },
  { label: "Piezas", render: (p) => p.pieces || "N/D" },
  { label: "Edad", render: (p) => p.age },
  { label: "Calificación", render: (p) => <Rating value={p.rating} showValue size="sm" className="justify-center" /> },
  {
    label: "Disponibilidad",
    render: (p) =>
      p.stock > 0 ? <Badge variant="success">{p.stock} disponibles</Badge> : <Badge variant="danger">Agotado</Badge>,
  },
];

function ProductHeader({ product }: { product: Product }) {
  const { toggleCompare } = useProductActions(product);
  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="relative">
      <IconButton
        label={`Quitar ${product.name} de la comparación`}
        variant="secondary"
        size="icon-sm"
        className="absolute -top-2 -right-2 z-10"
        onClick={toggleCompare}
      >
        <X aria-hidden="true" />
      </IconButton>
      <Link href={`/item/${product.id}`} className="group block rounded-xl">
        <span className="relative mx-auto mb-3 block size-32 rounded-xl bg-bg-subtle">
          <ProductImage src={product.img} alt="" fill sizes="128px" className="object-contain p-2" />
        </span>
        <span className="line-clamp-2 text-sm font-semibold text-fg group-hover:text-info">{product.name}</span>
      </Link>
    </motion.div>
  );
}

function ProductActions({ product }: { product: Product }) {
  return (
    <div className="flex flex-col gap-2">
      <AddToCartButton product={product} addLabel="Agregar" className="w-full" />
      <Button variant="secondary" size="sm" className="w-full" render={<Link href={`/item/${product.id}`} />}>
        Ver detalles
      </Button>
    </div>
  );
}

export default function ComparePage() {
  const hydrated = useStoreHydrated(useCompareStore);
  const ids = useCompareIds();
  const clearCompare = useCompareStore((state) => state.clearCompare);
  const { products, isLoading } = useProductsByIds(ids, { onMissing: useCompareStore.getState().removeMany });

  if (!hydrated || isLoading) {
    return (
      <div className="container-custom py-8" aria-busy="true">
        <h1 className="sr-only">Comparar productos</h1>
        <Skeleton className="mb-8 h-10 w-48" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <PageTransition>
        <div className="container-custom py-16">
          <h1 className="sr-only">Comparar productos</h1>
          <EmptyState
            icon={<Scale />}
            title="No hay productos para comparar"
            description="Agrega productos a la comparación para ver sus características lado a lado."
            action={
              <Button size="lg" render={<Link href="/" />}>
                <ChevronLeft aria-hidden="true" />
                Explorar productos
              </Button>
            }
          />
        </div>
      </PageTransition>
    );
  }

  const emptySlots = Math.max(0, MAX_COMPARE_ITEMS - products.length);
  const empty = (key: string) =>
    Array.from({ length: emptySlots }, (_, i) => <td key={`${key}-${i}`} className="p-4" />);

  return (
    <PageTransition>
      <div className="container-custom py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl">Comparar productos</h1>
            <p className="mt-1 text-fg-muted">
              {products.length} de {MAX_COMPARE_ITEMS} productos como máximo
            </p>
          </div>
          <Button variant="outline" onClick={clearCompare}>
            Limpiar todo
          </Button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-card">
          <table className="w-full min-w-[800px] text-sm">
            <caption className="sr-only">Características de los productos seleccionados</caption>
            <thead>
              <tr>
                <th scope="col" className="w-48 border-b border-border p-4 text-left font-medium text-fg-muted">
                  Producto
                </th>
                {products.map((product) => (
                  <th key={product.id} scope="col" className="border-b border-border p-4 align-top font-normal">
                    <ProductHeader product={product} />
                  </th>
                ))}
                {Array.from({ length: emptySlots }, (_, i) => (
                  <td key={`slot-${i}`} className="border-b border-border p-4 align-top">
                    <Link
                      href="/"
                      className="mx-auto flex size-32 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border-strong text-center text-sm text-fg-muted transition-colors duration-fast hover:border-info hover:text-info"
                    >
                      <Plus aria-hidden="true" className="size-5" />
                      Agregar producto
                    </Link>
                  </td>
                ))}
              </tr>
            </thead>

            <tbody>
              <tr className="bg-bg-subtle">
                <th scope="row" className="p-4 text-left font-medium text-fg">
                  Precio
                </th>
                {products.map((product) => (
                  <td key={product.id} className="p-4">
                    <Price
                      value={product.price}
                      originalValue={product.isOnSale ? product.originalPrice : undefined}
                      className="justify-center"
                    />
                  </td>
                ))}
                {empty("price")}
              </tr>

              {specs.map((spec, index) => (
                <tr key={spec.label} className={cn(index % 2 === 1 && "bg-bg-subtle")}>
                  <th scope="row" className="p-4 text-left font-medium text-fg">
                    {spec.label}
                  </th>
                  {products.map((product) => (
                    <td key={product.id} className="p-4 text-center text-fg">
                      {spec.render(product)}
                    </td>
                  ))}
                  {empty(spec.label)}
                </tr>
              ))}

              <tr className="border-t border-border">
                <th scope="row" className="p-4 text-left font-medium text-fg">
                  Acciones
                </th>
                {products.map((product) => (
                  <td key={product.id} className="p-4">
                    <ProductActions product={product} />
                  </td>
                ))}
                {empty("actions")}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </PageTransition>
  );
}
