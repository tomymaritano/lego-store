"use client";

import { useEffect, useId, useRef } from "react";
import { CloudOff, SearchX, SlidersHorizontal } from "lucide-react";
import { useCatalogQuery } from "@/hooks/useCatalogQuery";
import { useProductPages } from "@/hooks/useProductPages";
import { listActiveFilters, removeFilter, serializeProductQuery } from "@/lib/productQuery";
import { cn, pluralize } from "@/lib/utils";
import {
  Badge,
  Button,
  EmptyState,
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui";
import type { FilterOptions, PaginatedResponse, Product, ProductQuery } from "@/types";
import { ActiveFilters } from "./ActiveFilters";
import { ProductFilters } from "./ProductFilters";
import { ProductGrid } from "./ProductGrid";
import { LoadMore } from "./ProductList";
import { ProductSort } from "./ProductSort";

interface CatalogViewProps {
  /** First page for the URL the server rendered. */
  initialPage: PaginatedResponse<Product>;
  /** The URL query the server rendered (search text, filters, sort). */
  initialQuery: ProductQuery;
  /** Fixed by the route, not the URL (a category page): merged into every request. */
  scope?: Pick<ProductQuery, "category">;
  /** Filter values and counts in scope (getFilterOptions). */
  options: FilterOptions;
  /** Offer the category facet (only where the route does not fix one). */
  showCategories?: boolean;
}

const EAGER_IMAGES = 3;

/**
 * Filterable, sortable product listing for the category and search pages.
 * Filters, sort and search live in the URL (useCatalogQuery), so a filtered
 * view can be shared and Back undoes the last change; results come from
 * /api/products and animate in place. Filters sit in a sidebar on desktop
 * and in a bottom sheet on phones.
 */
export function CatalogView({ initialPage, initialQuery, scope, options, showCategories = false }: CatalogViewProps) {
  const { query, update, setQuery, clear } = useCatalogQuery();
  const apiQuery = { ...query, ...scope };
  const pages = useProductPages({ query: apiQuery, initialPage, initialQuery: { ...initialQuery, ...scope } });

  const filterCount = listActiveFilters(query).length;
  const resultsRef = useRef<HTMLElement>(null);
  const countRef = useRef<HTMLParagraphElement>(null);
  const filtersTitleId = useId();
  const resultsTitleId = useId();

  // When the results change while scrolled down the grid, bring their top back into view.
  const queryKey = serializeProductQuery(query).toString();
  const lastKey = useRef(queryKey);
  useEffect(() => {
    if (lastKey.current === queryKey) return;
    lastKey.current = queryKey;
    const section = resultsRef.current;
    if (section && section.getBoundingClientRect().top < 0) section.scrollIntoView({ block: "start" });
  }, [queryKey]);

  const filters = (
    <ProductFilters options={options} query={query} onChange={update} showCategories={showCategories} />
  );

  const countText = pluralize(pages.total, "producto");

  return (
    <div className="lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:items-start lg:gap-10">
      <aside aria-labelledby={filtersTitleId} className="hidden lg:sticky lg:top-24 lg:block">
        <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-card">
          <div className="mb-5 flex items-center justify-between gap-2">
            <h2 id={filtersTitleId} className="flex items-center gap-2 text-title">
              <SlidersHorizontal aria-hidden="true" className="size-5" />
              Filtros
            </h2>
            {filterCount > 0 ? (
              <Button variant="link" size="sm" onClick={clear}>
                Limpiar
              </Button>
            ) : null}
          </div>
          {filters}
        </div>
      </aside>

      <section ref={resultsRef} aria-labelledby={resultsTitleId} className="min-w-0 scroll-mt-24">
        <h2 id={resultsTitleId} className="sr-only">
          Productos
        </h2>

        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <p
            ref={countRef}
            tabIndex={-1}
            role="status"
            aria-busy={pages.isStale || undefined}
            className="rounded-sm text-body text-fg-secondary outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            data-testid="result-count"
          >
            <span className="font-bold text-fg tabular-nums">{pages.total}</span>{" "}
            {pages.total === 1 ? "producto" : "productos"}
          </p>

          <div className="flex w-full items-end gap-3 sm:w-auto">
            <Sheet>
              <SheetTrigger
                render={
                  <Button variant="secondary" className="shrink-0 lg:hidden" aria-label={filterCount ? `Filtros, ${filterCount} activos` : "Filtros"} />
                }
              >
                <SlidersHorizontal aria-hidden="true" />
                Filtros
                {filterCount > 0 ? (
                  <Badge variant="new" aria-hidden="true" className="px-2">
                    {filterCount}
                  </Badge>
                ) : null}
              </SheetTrigger>
              <SheetContent side="bottom" className="mx-auto max-w-lg">
                <SheetHeader>
                  <SheetTitle>Filtros</SheetTitle>
                </SheetHeader>
                <SheetBody className="px-4 py-5">{filters}</SheetBody>
                <SheetFooter className="flex-row">
                  <Button variant="ghost" className="flex-1" onClick={clear}>
                    Limpiar
                  </Button>
                  <SheetClose render={<Button className="flex-1" />}>Ver {countText}</SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            <ProductSort
              value={query.sort ?? "featured"}
              onChange={(sort) => setQuery({ ...query, sort: sort === "featured" ? undefined : sort })}
              className="flex-1 sm:flex-none"
            />
          </div>
        </div>

        <ActiveFilters
          query={query}
          options={options}
          onRemove={(filter) => setQuery(removeFilter(query, filter))}
          onClear={clear}
          fallbackFocusRef={countRef}
        />

        <div className={cn(filterCount > 0 && "mt-4")}>
          {pages.isError ? (
            <EmptyState
              icon={<CloudOff />}
              title="No pudimos cargar los productos"
              description="Revisa tu conexión e inténtalo de nuevo."
              action={<Button onClick={() => void pages.refetch()}>Reintentar</Button>}
            />
          ) : pages.total === 0 && !pages.isStale ? (
            <EmptyState
              icon={<SearchX />}
              title="Ningún set coincide con estos filtros"
              description="Prueba quitar algún filtro o ampliar el rango de precio."
              action={
                filterCount > 0 ? (
                  <Button
                    onClick={() => {
                      clear();
                      requestAnimationFrame(() => countRef.current?.focus());
                    }}
                  >
                    Limpiar filtros
                  </Button>
                ) : null
              }
              className="rounded-2xl border border-dashed border-border-strong"
              data-testid="catalog-empty"
            />
          ) : (
            <>
              <ProductGrid
                products={pages.products}
                batchSize={pages.pageSize}
                eagerCount={EAGER_IMAGES}
                columns={3}
                busy={pages.isStale}
                label={countText}
              />
              <LoadMore {...pages} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
