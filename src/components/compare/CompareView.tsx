"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronsLeftRight, Plus, Scale, X } from "lucide-react";
import { fadeIn, fadeInUp, gridItem, transitions } from "@/lib/motion";
import { COMPARE_ROWS, differingRows, type CompareRowKey } from "@/lib/compare";
import { cn } from "@/lib/utils";
import { MAX_COMPARE_ITEMS, positionIn, useCompareIds, useCompareStore, useStoreHydrated } from "@/stores";
import { productActionCopy } from "@/hooks/useProductActions";
import { useProductsByIds } from "@/hooks/useProductsByIds";
import { Badge, Button, Checkbox, EmptyState, IconButton, Price, Rating, Skeleton, showToast } from "@/components/ui";
import { AddToCartButton, ProductImage } from "@/components/product";
import { CategoryName } from "@/providers/CategoriesProvider";
import type { Product } from "@/types";

function renderValue(product: Product, key: CompareRowKey) {
  switch (key) {
    case "price":
      return (
        <Price
          value={product.price}
          originalValue={product.isOnSale ? product.originalPrice : undefined}
          size="sm"
          className="justify-center"
        />
      );
    case "category":
      return <CategoryName id={product.category} />;
    case "rating":
      return <Rating value={product.rating} showValue size="sm" className="justify-center" />;
    case "availability":
      return product.stock > 0 ? (
        <Badge variant="success">{product.stock} disponibles</Badge>
      ) : (
        <Badge variant="danger">Agotado</Badge>
      );
    case "pieces":
      return product.pieces || "N/D";
    default:
      return product[key];
  }
}

/** Focus after a column leaves: the next product's remove button, or the heading. */
function focusAfterRemoval(neighbourId: string | undefined) {
  requestAnimationFrame(() => {
    const next =
      neighbourId && document.querySelector<HTMLElement>(`[data-remove-compare="${CSS.escape(neighbourId)}"]`);
    (next || document.getElementById("compare-title"))?.focus();
  });
}

function remove(product: Product) {
  const { ids, removeFromCompare, restoreId } = useCompareStore.getState();
  const at = positionIn(ids, product.id);
  removeFromCompare(product.id);
  focusAfterRemoval(ids[at.index + 1] ?? ids[at.index - 1]);
  showToast.undo(productActionCopy.removedFromCompare(product.name), () => restoreId(product.id, at));
}

/** Undo puts back only the cleared ids; ids added since then stay (up to the limit). */
function clearAll() {
  const { ids: before, clearCompare } = useCompareStore.getState();
  clearCompare();
  focusAfterRemoval(undefined);
  showToast.undo(productActionCopy.compareCleared(), () => {
    const { restoreId } = useCompareStore.getState();
    before.forEach((id, index) => restoreId(id, { index }));
  });
}

/** Cells move to their new column when a product is removed. */
const cellMotion = { layout: "position" as const, transition: { layout: transitions.spring } };

const STICKY_LABEL =
  "sticky left-0 z-20 w-28 min-w-28 border-r border-border bg-surface p-3 text-left align-middle sm:w-44 sm:min-w-44 sm:p-4";
const VALUE_CELL = "w-40 min-w-40 p-3 text-center align-middle sm:w-56 sm:min-w-56 sm:p-4";

/**
 * Compare page body (client island): up to four products side by side, ids
 * from the compare store, products hydrated through the by-ids Route Handler
 * (lib/api). On narrow screens the table scrolls sideways while the label
 * column stays put. "Resaltar diferencias" tints the rows whose values differ
 * and marks them in the label for screen readers.
 */
export function CompareView() {
  const hydrated = useStoreHydrated(useCompareStore);
  const ids = useCompareIds();
  const { products, isLoading } = useProductsByIds(ids, { onMissing: useCompareStore.getState().removeMany });
  const [highlight, setHighlight] = useState(false);

  const loading = !hydrated || isLoading;
  const empty = !loading && products.length === 0;
  const differing = differingRows(products);
  const canAddMore = products.length < MAX_COMPARE_ITEMS;
  const showDifferences = highlight && products.length > 1;

  return (
    <div className="container-custom py-8 md:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div>
          <h1 id="compare-title" tabIndex={-1} className="text-3xl outline-none md:text-4xl">
            Comparar productos
          </h1>
          {!loading && !empty ? (
            <p className="mt-1 text-fg-muted" data-testid="compare-page-count">
              {products.length} de {MAX_COMPARE_ITEMS} productos como máximo
            </p>
          ) : null}
        </div>
        {!loading && !empty ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Checkbox
              label="Resaltar diferencias"
              checked={highlight}
              onCheckedChange={(checked) => setHighlight(checked === true)}
              disabled={products.length < 2}
              data-testid="highlight-differences"
            />
            <Button variant="ghost" size="sm" onClick={clearAll} className="hover:text-danger">
              Limpiar todo
            </Button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div aria-busy="true" className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <span className="sr-only">Cargando comparación…</span>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className={cn("h-96 rounded-2xl", i > 2 && "hidden md:block")} />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {empty ? (
            <motion.div
              key="empty"
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="rounded-2xl border border-dashed border-border-strong bg-bg-subtle"
            >
              <EmptyState
                icon={<Scale />}
                title="No hay productos para comparar"
                description={`Toca el ícono de balanza en cualquier set para compararlo. Puedes elegir hasta ${MAX_COMPARE_ITEMS}.`}
                action={
                  <Button size="lg" render={<Link href="/" />}>
                    Explorar productos
                    <ArrowRight aria-hidden="true" />
                  </Button>
                }
              />
            </motion.div>
          ) : (
            <motion.div key="table" variants={fadeIn} initial="hidden" animate="visible" exit="exit">
              {products.length > 1 ? (
                <p className="mb-3 flex items-center gap-1.5 text-caption text-fg-muted md:hidden">
                  <ChevronsLeftRight aria-hidden="true" className="size-4" />
                  Desliza la tabla para ver todos los productos
                </p>
              ) : null}
              <div
                role="region"
                aria-labelledby="compare-title"
                tabIndex={0}
                className="overflow-x-auto overscroll-x-contain rounded-2xl border border-border bg-surface shadow-card focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
                data-testid="compare-scroller"
              >
                <table className="w-full border-separate border-spacing-0 text-sm" data-highlight={showDifferences || undefined}>
                  <caption className="sr-only">
                    Características de los productos seleccionados
                    {showDifferences ? ". Las filas con valores distintos están resaltadas." : ""}
                  </caption>
                  <thead>
                    <tr>
                      <td className={cn(STICKY_LABEL, "border-b align-bottom text-fg-muted")}>
                        <span className="text-caption font-semibold tracking-wider uppercase">Producto</span>
                      </td>
                      {products.map((product, index) => (
                        <motion.th
                          key={product.id}
                          {...cellMotion}
                          scope="col"
                          className={cn(VALUE_CELL, "border-b border-border align-top font-normal")}
                          data-testid="compare-column"
                        >
                          <motion.div variants={gridItem} custom={index} initial="hidden" animate="visible" className="relative">
                            <IconButton
                              label={`Quitar ${product.name} de la comparación`}
                              variant="secondary"
                              size="icon-sm"
                              className="absolute -top-1 right-0 shadow-sm hover:text-danger"
                              onClick={() => remove(product)}
                              data-remove-compare={product.id}
                            >
                              <X aria-hidden="true" />
                            </IconButton>
                            <Link
                              href={`/item/${product.id}`}
                              className="group flex flex-col items-center gap-3 rounded-xl"
                            >
                              <span className="relative block size-24 rounded-xl bg-bg-subtle sm:size-32">
                                <ProductImage
                                  src={product.img}
                                  alt=""
                                  fill
                                  sizes="128px"
                                  className="object-contain p-2 transition-[scale] duration-slow ease-emphasized group-hover:scale-105"
                                />
                              </span>
                              <span className="line-clamp-2 text-sm font-semibold text-fg group-hover:text-info">
                                {product.name}
                              </span>
                            </Link>
                          </motion.div>
                        </motion.th>
                      ))}
                      {canAddMore ? (
                        <td className={cn(VALUE_CELL, "border-b border-border align-top")}>
                          <Link
                            href="/"
                            className="mx-auto flex h-40 max-w-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong p-3 text-center text-sm text-fg-muted transition-colors duration-fast hover:border-info hover:text-info"
                          >
                            <Plus aria-hidden="true" className="size-5" />
                            Agregar producto
                            <span className="text-caption">
                              {MAX_COMPARE_ITEMS - products.length === 1
                                ? "Queda 1 lugar"
                                : `Quedan ${MAX_COMPARE_ITEMS - products.length} lugares`}
                            </span>
                          </Link>
                        </td>
                      ) : null}
                    </tr>
                  </thead>

                  <tbody>
                    {COMPARE_ROWS.map((row) => {
                      const differs = differing.has(row.key);
                      const marked = showDifferences && differs;
                      return (
                        <tr key={row.key} data-differs={differs || undefined} data-testid={`compare-row-${row.key}`}>
                          <th
                            scope="row"
                            className={cn(
                              STICKY_LABEL,
                              "border-b font-medium text-fg transition-colors duration-base",
                              marked &&
                                "bg-row-highlight before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-info"
                            )}
                          >
                            <span className="flex items-center gap-2">
                              {marked ? <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-info" /> : null}
                              {row.label}
                              {marked ? <span className="sr-only"> (valores distintos)</span> : null}
                            </span>
                          </th>
                          {products.map((product) => (
                            <motion.td
                              key={product.id}
                              {...cellMotion}
                              className={cn(
                                VALUE_CELL,
                                "border-b border-border text-fg transition-colors duration-base",
                                marked && "bg-row-highlight"
                              )}
                            >
                              {renderValue(product, row.key)}
                            </motion.td>
                          ))}
                          {canAddMore ? (
                            <td
                              data-testid="compare-filler-cell"
                              className={cn(
                                VALUE_CELL,
                                "border-b border-border transition-colors duration-base",
                                marked && "bg-row-highlight"
                              )}
                            />
                          ) : null}
                        </tr>
                      );
                    })}
                    <tr>
                      <th scope="row" className={cn(STICKY_LABEL, "font-medium text-fg")}>
                        Acciones
                      </th>
                      {products.map((product) => (
                        <motion.td key={product.id} {...cellMotion} className={VALUE_CELL}>
                          <div className="flex flex-col gap-2">
                            <AddToCartButton product={product} addLabel="Agregar" className="w-full" />
                            <Button variant="ghost" size="sm" className="w-full" render={<Link href={`/item/${product.id}`} />}>
                              Ver detalles
                              <span className="sr-only"> de {product.name}</span>
                            </Button>
                          </div>
                        </motion.td>
                      ))}
                      {canAddMore ? <td className={VALUE_CELL} /> : null}
                    </tr>
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
