"use client";

import Link from "next/link";
import { ArrowRight, Clock, TrendingUp } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { highlightMatches } from "@/lib/highlight";
import { Button } from "@/components/ui";
import { ProductImage } from "@/components/product/ProductImage";
import type { SearchSuggestion } from "@/types";

const POPULAR_SEARCHES = ["Star Wars", "Marvel", "Batman", "Harry Potter", "Technic"];

const sectionLabel = "flex items-center gap-2 px-3 py-2 text-caption font-semibold tracking-wider text-fg-muted uppercase";

/** The query's words in bold + underlined inside a suggestion. */
function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightMatches(text, query).map((segment, index) =>
        segment.match ? (
          <mark
            key={index}
            className="bg-transparent font-bold text-fg underline decoration-primary decoration-2 underline-offset-2"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </>
  );
}

interface SuggestionPanelProps {
  listboxId: string;
  optionId: (index: number) => string;
  activeIndex: number;
  onActivate: (index: number) => void;
  /** The (debounced) query the suggestions answer, for highlighting. */
  query: string;
  suggestions: SearchSuggestion[];
  /** Matches in the whole catalogue ("Ver los N resultados"). */
  total: number;
  /** Recent searches listed as options (only while the field is nearly empty). */
  recent: string[];
  showNoResults: boolean;
  /** Popular-search chips and "Borrar recientes" (empty or one-letter field). */
  showStarters: boolean;
  onOpenProduct: (id: string) => void;
  onSearch: (term: string) => void;
  onSearchAll: () => void;
  onClearRecent: () => void;
}

/**
 * What the search combobox shows under the field: the listbox (product
 * suggestions, then recent searches, all options for aria-activedescendant),
 * "Ver los N resultados", the no-results note, and the popular-search chips
 * (plain buttons outside the listbox).
 */
export function SuggestionPanel({
  listboxId,
  optionId,
  activeIndex,
  onActivate,
  query,
  suggestions,
  total,
  recent,
  showNoResults,
  showStarters,
  onOpenProduct,
  onSearch,
  onSearchAll,
  onClearRecent,
}: SuggestionPanelProps) {
  return (
    <>
      <ul id={listboxId} role="listbox" aria-label="Sugerencias de búsqueda" className="p-2 empty:hidden">
        {suggestions.length > 0 && (
          <li role="presentation" className={sectionLabel}>
            Productos
          </li>
        )}
        {suggestions.map((product, index) => (
          <li key={product.id} role="presentation">
            <Link
              id={optionId(index)}
              role="option"
              aria-selected={activeIndex === index}
              tabIndex={-1}
              href={`/item/${product.id}`}
              onClick={(event) => {
                event.preventDefault();
                onOpenProduct(product.id);
              }}
              onPointerMove={() => onActivate(index)}
              className={cn(
                "flex items-center gap-3 rounded-xl p-2 transition-colors duration-fast ease-standard",
                activeIndex === index && "bg-bg-muted"
              )}
              data-testid="search-result"
            >
              <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-bg-subtle">
                <ProductImage src={product.img} alt="" fill sizes="48px" className="object-contain p-1" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-sm font-medium text-fg-secondary">
                  <Highlight text={product.name} query={query} />
                </span>
                <span className="block text-caption text-fg-muted">
                  <Highlight text={product.theme} query={query} />
                </span>
              </span>
              <span className="text-sm font-bold text-fg tabular-nums">{formatPrice(product.price)}</span>
            </Link>
          </li>
        ))}

        {recent.length > 0 && (
          <li role="presentation" className={sectionLabel}>
            <Clock aria-hidden="true" className="size-3" />
            Búsquedas recientes
          </li>
        )}
        {recent.map((term, i) => {
          const index = suggestions.length + i;
          return (
            <li
              key={term}
              id={optionId(index)}
              role="option"
              aria-selected={activeIndex === index}
              onClick={() => onSearch(term)}
              onPointerMove={() => onActivate(index)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-fg-secondary transition-colors duration-fast ease-standard",
                activeIndex === index && "bg-bg-muted text-fg"
              )}
            >
              <Clock aria-hidden="true" className="size-4 text-fg-muted" />
              {term}
            </li>
          );
        })}
      </ul>

      {suggestions.length > 0 && (
        <div className="px-2 pb-2">
          <Button variant="ghost" className="w-full text-info hover:text-info" onClick={onSearchAll}>
            Ver los {total} resultados
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      )}

      {showNoResults && (
        <div className="p-6 text-center">
          <p className="text-fg-secondary">No se encontraron productos para &quot;{query}&quot;</p>
          <p className="mt-1 text-sm text-fg-muted">Intenta con otros términos de búsqueda</p>
        </div>
      )}

      {showStarters && (
        <div className="space-y-2 p-2 pt-0">
          {recent.length > 0 && (
            <div className="flex justify-end px-1">
              <Button variant="link" size="sm" className="text-caption" onClick={onClearRecent}>
                Borrar recientes
              </Button>
            </div>
          )}
          <p className={sectionLabel}>
            <TrendingUp aria-hidden="true" className="size-3" />
            Búsquedas populares
          </p>
          <div className="flex flex-wrap gap-2 px-3 pb-2">
            {POPULAR_SEARCHES.map((term) => (
              <Button key={term} variant="secondary" size="sm" className="rounded-full" onClick={() => onSearch(term)}>
                {term}
              </Button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
