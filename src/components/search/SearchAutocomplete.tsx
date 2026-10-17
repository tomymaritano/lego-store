"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, Search, TrendingUp, X } from "lucide-react";
import { dropDown, fadeIn } from "@/lib/motion";
import { cn, formatPrice } from "@/lib/utils";
import { highlightMatches } from "@/lib/highlight";
import { fetchSearchSuggestions } from "@/lib/api-client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button, IconButton, Input, Spinner } from "@/components/ui";
import { ProductImage } from "@/components/product/ProductImage";

interface SearchAutocompleteProps {
  onClose?: () => void;
  className?: string;
  autoFocus?: boolean;
  /**
   * "popover" (Navbar): suggestions drop down while the field has focus.
   * "inline" (full-screen mobile search): suggestions are always laid out
   * under the field and scroll with the container.
   */
  variant?: "popover" | "inline";
}

const POPULAR_SEARCHES = ["Star Wars", "Marvel", "Batman", "Harry Potter", "Technic"];
const MAX_SUGGESTIONS = 5;
const MAX_RECENT = 5;
const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;
const RECENT_KEY = "lego-recent-searches";

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(query: string) {
  try {
    const next = [query, ...readRecent().filter((s) => s.toLowerCase() !== query.toLowerCase())].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode): recent searches are a nicety.
  }
}

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

const sectionLabel = "flex items-center gap-2 px-3 py-2 text-caption font-semibold tracking-wider text-fg-muted uppercase";

/**
 * Store search box (ARIA 1.2 combobox with a listbox popup). Suggestions come
 * from GET /api/search (same algorithm as /search), debounced, and a newer
 * query aborts the request in flight (React Query passes the AbortSignal);
 * the catalogue never ships to the browser. Arrow keys move through the
 * options (aria-activedescendant), Enter opens one or runs the full search,
 * Escape closes the popup and then clears the field. Recent searches are
 * kept in localStorage.
 */
export function SearchAutocomplete({ onClose, className, autoFocus = false, variant = "popover" }: SearchAutocompleteProps) {
  const inline = variant === "inline";
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<string[]>(() => (inline && typeof window !== "undefined" ? readRecent() : []));

  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, DEBOUNCE_MS);
  const searching = debounced.length >= MIN_QUERY;

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: ({ signal }) => fetchSearchSuggestions(debounced, MAX_SUGGESTIONS, signal),
    enabled: searching,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const suggestions = searching ? (data?.items ?? []) : [];
  const total = searching ? (data?.total ?? 0) : 0;
  const recentOptions = trimmed.length < MIN_QUERY ? recent : [];
  const optionCount = suggestions.length + recentOptions.length;
  const optionId = (index: number) => `${listboxId}-option-${index}`;
  // The listbox is the combobox popup: it is only "expanded" while it has
  // options. The popular-search chips are plain buttons outside it, so a panel
  // showing only those leaves the combobox collapsed.
  const expanded = (inline || isOpen) && optionCount > 0;

  // Reset the highlighted option whenever the option list changes.
  const [prevKey, setPrevKey] = useState("");
  const optionsKey = `${debounced}|${suggestions.length}|${recentOptions.length}`;
  if (optionsKey !== prevKey) {
    setPrevKey(optionsKey);
    setActiveIndex(-1);
  }

  useEffect(() => {
    if (inline) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [inline]);

  // Keep the keyboard-highlighted option in view (long lists in the inline variant).
  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: "nearest" });
    // optionId only depends on listboxId, which is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const close = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const finish = () => {
    setQuery("");
    close();
    onClose?.();
  };

  const runSearch = (term: string) => {
    const value = term.trim();
    if (!value) return;
    saveRecent(value);
    router.push(`/search?q=${encodeURIComponent(value)}`);
    finish();
  };

  const openProduct = (id: string) => {
    if (trimmed) saveRecent(trimmed);
    router.push(`/item/${id}`);
    finish();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setIsOpen(true);
        if (optionCount) setActiveIndex((i) => (i + 1) % optionCount);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (optionCount) setActiveIndex((i) => (i <= 0 ? optionCount - 1 : i - 1));
        break;
      case "Enter":
        event.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) openProduct(suggestions[activeIndex].id);
        else if (activeIndex >= suggestions.length) runSearch(recentOptions[activeIndex - suggestions.length]);
        else runSearch(query);
        break;
      case "Escape":
        // Inline: an empty field lets Escape through to close the full-screen sheet.
        if (!inline && isOpen) {
          event.preventDefault();
          close();
        } else if (query) {
          event.preventDefault();
          event.stopPropagation();
          setQuery("");
          setActiveIndex(-1);
        }
        break;
    }
  };

  const clearRecent = () => {
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      // ignore
    }
    setRecent([]);
  };

  const showNoResults = searching && !isFetching && data !== undefined && total === 0;
  const status = !searching
    ? ""
    : isFetching
      ? "Buscando…"
      : total === 0
        ? `Sin resultados para ${debounced}`
        : `${suggestions.length} ${suggestions.length === 1 ? "sugerencia" : "sugerencias"} de ${total} resultados`;

  const panel = (
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
                openProduct(product.id);
              }}
              onPointerMove={() => setActiveIndex(index)}
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
                  <Highlight text={product.name} query={debounced} />
                </span>
                <span className="block text-caption text-fg-muted">
                  <Highlight text={product.theme} query={debounced} />
                </span>
              </span>
              <span className="text-sm font-bold text-fg tabular-nums">{formatPrice(product.price)}</span>
            </Link>
          </li>
        ))}

        {recentOptions.length > 0 && (
          <li role="presentation" className={sectionLabel}>
            <Clock aria-hidden="true" className="size-3" />
            Búsquedas recientes
          </li>
        )}
        {recentOptions.map((term, i) => {
          const index = suggestions.length + i;
          return (
            <li
              key={term}
              id={optionId(index)}
              role="option"
              aria-selected={activeIndex === index}
              onClick={() => runSearch(term)}
              onPointerMove={() => setActiveIndex(index)}
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
          <Button variant="ghost" className="w-full text-info hover:text-info" onClick={() => runSearch(query)}>
            Ver los {total} resultados
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      )}

      {showNoResults && (
        <div className="p-6 text-center">
          <p className="text-fg-secondary">No se encontraron productos para &quot;{debounced}&quot;</p>
          <p className="mt-1 text-sm text-fg-muted">Intenta con otros términos de búsqueda</p>
        </div>
      )}

      {trimmed.length < MIN_QUERY && (
        <div className="space-y-2 p-2 pt-0">
          {recentOptions.length > 0 && (
            <div className="flex justify-end px-1">
              <Button variant="link" size="sm" className="text-caption" onClick={clearRecent}>
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
              <Button key={term} variant="secondary" size="sm" className="rounded-full" onClick={() => runSearch(term)}>
                {term}
              </Button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onBlur={(event) => {
        if (inline) return;
        // Keep the panel while focus moves inside it (chips, "Ver los N resultados");
        // close it once keyboard focus leaves the combobox altogether.
        const next = event.relatedTarget as Node | null;
        if (!next || !containerRef.current?.contains(next)) close();
      }}
    >
      <form
        role="search"
        className={cn("relative", inline && "border-b border-border p-4")}
        onSubmit={(event) => {
          event.preventDefault();
          runSearch(query);
        }}
      >
        <label htmlFor={`${listboxId}-input`} className="sr-only">
          Buscar productos
        </label>
        <Input
          ref={inputRef}
          id={`${listboxId}-input`}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listboxId}
          aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Buscar sets, temas, personajes…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setRecent(readRecent());
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          leftIcon={<Search />}
          className={cn(
            "rounded-full pr-10 text-sm [&::-webkit-search-cancel-button]:hidden",
            inline ? "h-12 text-body" : "h-10"
          )}
          data-testid="search-input"
        />
        <div className={cn("absolute inset-y-0 flex items-center", inline ? "right-5" : "right-1")}>
          {isFetching && searching ? (
            <Spinner className="mr-2 size-4 text-fg-muted" />
          ) : query ? (
            <IconButton
              label="Borrar búsqueda"
              size="icon-sm"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <X aria-hidden="true" />
            </IconButton>
          ) : null}
        </div>
      </form>

      <p role="status" className="sr-only">
        {status}
      </p>

      {inline ? (
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {panel}
        </motion.div>
      ) : (
        <AnimatePresence>
          {isOpen && (
            <motion.div
              variants={dropDown}
              initial="hidden"
              animate="visible"
              exit="exit"
              // Clicking inside the panel must not blur the input (that would close it before the click lands).
              onMouseDown={(event) => event.preventDefault()}
              className="absolute top-full right-0 left-0 z-50 mt-2 max-h-[min(32rem,calc(100dvh-6rem))] overflow-y-auto rounded-2xl border border-border bg-surface-raised text-fg shadow-xl"
            >
              {panel}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
