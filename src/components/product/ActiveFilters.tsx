"use client";

import type { RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { scaleIn, transitions } from "@/lib/motion";
import { listActiveFilters, type ActiveFilter } from "@/lib/productQuery";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui";
import type { FilterOptions, ProductQuery } from "@/types";

const GROUP_NAMES: Record<ActiveFilter["field"], string> = {
  category: "Categoría",
  themes: "Tema",
  types: "Tipo",
  ages: "Edad",
  interests: "Interés",
  pieces: "Piezas",
  highlights: "Colección",
  price: "Precio",
  minRating: "Calificación",
  onSale: "Disponibilidad",
  isNew: "Disponibilidad",
  inStock: "Disponibilidad",
};

/** Short visible text of a chip. */
export function describeFilter(filter: ActiveFilter, options?: Pick<FilterOptions, "categories">): string {
  switch (filter.field) {
    case "onSale":
      return "En oferta";
    case "isNew":
      return "Novedades";
    case "inStock":
      return "En stock";
    case "category":
      return options?.categories.find((c) => c.value === filter.value)?.label ?? filter.value;
    case "price":
      if (filter.min !== undefined && filter.max !== undefined) return `${formatPrice(filter.min)} – ${formatPrice(filter.max)}`;
      return filter.min !== undefined ? `Desde ${formatPrice(filter.min)}` : `Hasta ${formatPrice(filter.max ?? 0)}`;
    case "minRating":
      return `${String(filter.value).replace(".", ",")}★ o más`;
    case "pieces":
      return `${filter.value} piezas`;
    default:
      return filter.value;
  }
}

const chipKey = (filter: ActiveFilter) => `${filter.field}:${"value" in filter ? filter.value : ""}`;

interface ActiveFiltersProps {
  query: ProductQuery;
  options?: Pick<FilterOptions, "categories">;
  onRemove: (filter: ActiveFilter) => void;
  onClear: () => void;
  /** Receives focus when the focused chip disappears and no other chip is left (e.g. the result count). */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}

/** After a chip goes away, focus a neighbour chip, or the fallback. Never leave focus on <body>. */
function focusAfterRemoval(button: HTMLElement, fallback?: HTMLElement | null) {
  const item = button.closest("li");
  const neighbour = (item?.nextElementSibling ?? item?.previousElementSibling)?.querySelector("button");
  requestAnimationFrame(() => (neighbour ?? fallback)?.focus());
}

/**
 * Removable chips for the filters in use, plus "Limpiar todo". Chips pop in
 * and out and the row reflows smoothly (layout animation).
 */
export function ActiveFilters({ query, options, onRemove, onClear, fallbackFocusRef }: ActiveFiltersProps) {
  const active = listActiveFilters(query);

  return (
    <AnimatePresence initial={false}>
      {active.length > 0 ? (
        <motion.div
          key="active-filters"
          variants={scaleIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="flex flex-wrap items-center gap-2"
          role="region"
          aria-label="Filtros activos"
        >
          <ul className="flex flex-wrap items-center gap-2">
            <AnimatePresence initial={false} mode="popLayout">
              {active.map((filter) => {
                const text = describeFilter(filter, options);
                return (
                  <motion.li key={chipKey(filter)} layout variants={scaleIn} initial="hidden" animate="visible" exit="exit" transition={{ layout: transitions.spring }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-full pr-2 pl-3"
                      aria-label={`Quitar filtro ${GROUP_NAMES[filter.field]}: ${text}`}
                      onClick={(event) => {
                        focusAfterRemoval(event.currentTarget, fallbackFocusRef?.current);
                        onRemove(filter);
                      }}
                    >
                      {text}
                      <X aria-hidden="true" className="size-3.5" />
                    </Button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          <motion.div layout transition={{ layout: transitions.spring }}>
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                onClear();
                requestAnimationFrame(() => fallbackFocusRef?.current?.focus());
              }}
            >
              Limpiar todo
            </Button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
