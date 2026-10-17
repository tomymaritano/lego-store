"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { dropDown, fadeIn } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { fetchSearchSuggestions } from "@/lib/api-client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { IconButton, Input, Spinner } from "@/components/ui";
import { SuggestionPanel } from "./SuggestionPanel";
import { useListboxNavigation } from "./useListboxNavigation";
import { useRecentSearches } from "./useRecentSearches";

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

const MAX_SUGGESTIONS = 5;
const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;

/**
 * Store search box (ARIA 1.2 combobox with a listbox popup). Suggestions come
 * from GET /api/search (same algorithm as /search), debounced, and a newer
 * query aborts the request in flight (React Query passes the AbortSignal);
 * the catalogue never ships to the browser. Arrow keys move through the
 * options (aria-activedescendant), Enter opens one or runs the full search,
 * Escape closes the popup and then clears the field. Recent searches are
 * kept in localStorage (useRecentSearches); the arrow-key model lives in
 * useListboxNavigation and the panel's markup in SuggestionPanel.
 */
export function SearchAutocomplete({ onClose, className, autoFocus = false, variant = "popover" }: SearchAutocompleteProps) {
  const inline = variant === "inline";
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const recentSearches = useRecentSearches(inline);

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
  const recentOptions = trimmed.length < MIN_QUERY ? recentSearches.recent : [];
  const optionCount = suggestions.length + recentOptions.length;
  const listbox = useListboxNavigation(listboxId, optionCount, `${debounced}|${suggestions.length}|${recentOptions.length}`);
  const { activeIndex } = listbox;
  // The listbox is the combobox popup: it is only "expanded" while it has
  // options. The popular-search chips are plain buttons outside it, so a panel
  // showing only those leaves the combobox collapsed.
  const expanded = (inline || isOpen) && optionCount > 0;

  useEffect(() => {
    if (inline) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [inline]);

  const close = () => {
    setIsOpen(false);
    listbox.reset();
  };

  const finish = () => {
    setQuery("");
    close();
    onClose?.();
  };

  const runSearch = (term: string) => {
    const value = term.trim();
    if (!value) return;
    recentSearches.save(value);
    router.push(`/search?q=${encodeURIComponent(value)}`);
    finish();
  };

  const openProduct = (id: string) => {
    if (trimmed) recentSearches.save(trimmed);
    router.push(`/item/${id}`);
    finish();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setIsOpen(true);
        listbox.next();
        break;
      case "ArrowUp":
        event.preventDefault();
        listbox.previous();
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
          listbox.reset();
        }
        break;
    }
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
    <SuggestionPanel
      listboxId={listboxId}
      optionId={listbox.optionId}
      activeIndex={activeIndex}
      onActivate={listbox.setActiveIndex}
      query={debounced}
      suggestions={suggestions}
      total={total}
      recent={recentOptions}
      showNoResults={showNoResults}
      showStarters={trimmed.length < MIN_QUERY}
      onOpenProduct={openProduct}
      onSearch={runSearch}
      onSearchAll={() => runSearch(query)}
      onClearRecent={recentSearches.clear}
    />
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
          aria-activedescendant={expanded ? (listbox.activeOptionId ?? undefined) : undefined}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Buscar sets, temas, personajes…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            recentSearches.refresh();
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          leftIcon={<Search />}
          className={cn(
            "rounded-full pr-10 text-label font-normal [&::-webkit-search-cancel-button]:hidden",
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
        <m.div variants={fadeIn} initial="hidden" animate="visible" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {panel}
        </m.div>
      ) : (
        <AnimatePresence>
          {isOpen && (
            <m.div
              variants={dropDown}
              initial="hidden"
              animate="visible"
              exit="exit"
              // Clicking inside the panel must not blur the input (that would close it before the click lands).
              onMouseDown={(event) => event.preventDefault()}
              className="absolute top-full right-0 left-0 z-50 mt-2 max-h-[min(32rem,calc(100dvh-6rem))] overflow-y-auto rounded-2xl border border-border bg-surface-raised text-fg shadow-xl"
            >
              {panel}
            </m.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
