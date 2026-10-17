"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, Search, TrendingUp, X } from "lucide-react";
import { dropDown } from "@/lib/motion";
import { cn, formatPrice } from "@/lib/utils";
import { fetchSearchSuggestions } from "@/lib/api-client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button, IconButton, Input, Spinner } from "@/components/ui";

interface SearchAutocompleteProps {
  onClose?: () => void;
  className?: string;
  autoFocus?: boolean;
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

/**
 * Navbar search box (ARIA combobox). Suggestions come from GET /api/search
 * (same algorithm as /search), debounced; the catalogue never ships to the
 * browser. Arrow keys move through the options, Enter opens one or runs
 * the full search, Escape closes.
 */
export function SearchAutocomplete({ onClose, className, autoFocus = false }: SearchAutocompleteProps) {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);

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

  // Reset the highlighted option whenever the option list changes.
  const [prevKey, setPrevKey] = useState("");
  const optionsKey = `${debounced}|${suggestions.length}|${recentOptions.length}`;
  if (optionsKey !== prevKey) {
    setPrevKey(optionsKey);
    setActiveIndex(-1);
  }

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const close = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const runSearch = (term: string) => {
    const value = term.trim();
    if (!value) return;
    saveRecent(value);
    router.push(`/search?q=${encodeURIComponent(value)}`);
    setQuery("");
    close();
    onClose?.();
  };

  const openProduct = (id: string) => {
    if (trimmed) saveRecent(trimmed);
    router.push(`/item/${id}`);
    setQuery("");
    close();
    onClose?.();
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
        if (isOpen) {
          event.preventDefault();
          close();
        } else if (query) {
          setQuery("");
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

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <form
        role="search"
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
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          autoComplete="off"
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
          className="h-10 rounded-full border-transparent bg-bg-muted pr-10 text-sm [&::-webkit-search-cancel-button]:hidden"
          data-testid="search-input"
        />
        <div className="absolute inset-y-0 right-1 flex items-center">
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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={dropDown}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-surface-raised text-fg shadow-xl"
          >
            <ul id={listboxId} role="listbox" aria-label="Sugerencias de búsqueda" className="p-2 empty:hidden">
              {suggestions.length > 0 && (
                <li role="presentation" className="px-3 py-2 text-caption font-semibold tracking-wider text-fg-muted uppercase">
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
                      "flex items-center gap-3 rounded-xl p-2 transition-colors duration-fast",
                      activeIndex === index && "bg-bg-muted"
                    )}
                    data-testid="search-result"
                  >
                    <span className="relative size-12 shrink-0 rounded-lg bg-bg-subtle">
                      <Image src={product.img} alt="" fill sizes="48px" className="object-contain p-1" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm font-medium">{product.name}</span>
                      <span className="text-caption text-fg-muted">{product.theme}</span>
                    </span>
                    <span className="text-sm font-bold tabular-nums">{formatPrice(product.price)}</span>
                  </Link>
                </li>
              ))}

              {recentOptions.length > 0 && (
                <li role="presentation" className="flex items-center justify-between px-3 py-2">
                  <span className="flex items-center gap-2 text-caption font-semibold tracking-wider text-fg-muted uppercase">
                    <Clock aria-hidden="true" className="size-3" />
                    Búsquedas recientes
                  </span>
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
                      "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-fg-secondary transition-colors duration-fast",
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
                <Button variant="ghost" className="w-full text-info" onClick={() => runSearch(query)}>
                  Ver los {total} resultados
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            )}

            {showNoResults && (
              <div className="p-6 text-center" role="status">
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
                <p className="flex items-center gap-2 px-3 py-2 text-caption font-semibold tracking-wider text-fg-muted uppercase">
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
