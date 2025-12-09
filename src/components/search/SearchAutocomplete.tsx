"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Clock, TrendingUp, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { products } from "@/data/products";
import { formatPrice, cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { Product } from "@/types";

interface SearchAutocompleteProps {
  onClose?: () => void;
  className?: string;
  autoFocus?: boolean;
}

const POPULAR_SEARCHES = ["Star Wars", "Marvel", "Batman", "Harry Potter", "Technic"];
const MAX_SUGGESTIONS = 5;
const MAX_RECENT = 5;

// Get recent searches from localStorage
const getRecentSearches = (): string[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem("lego-recent-searches");
  return stored ? JSON.parse(stored) : [];
};

// Save search to recent
const saveRecentSearch = (query: string) => {
  if (typeof window === "undefined") return;
  const recent = getRecentSearches();
  const filtered = recent.filter((s) => s.toLowerCase() !== query.toLowerCase());
  const updated = [query, ...filtered].slice(0, MAX_RECENT);
  localStorage.setItem("lego-recent-searches", JSON.stringify(updated));
};

// Clear recent searches
const clearRecentSearches = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("lego-recent-searches");
};

export function SearchAutocomplete({ onClose, className, autoFocus = false }: SearchAutocompleteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Load recent searches
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Search products with debounced query (300ms delay)
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const searchTerms = debouncedQuery.toLowerCase().split(" ");
    const results = products.filter((product) => {
      const searchableText = `${product.name} ${product.theme} ${product.category} ${product.description}`.toLowerCase();
      return searchTerms.every((term) => searchableText.includes(term));
    });

    setSuggestions(results.slice(0, MAX_SUGGESTIONS));
    setSelectedIndex(-1);
  }, [debouncedQuery]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const totalItems = suggestions.length + (query.length < 2 ? recentSearches.length : 0);

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0) {
            if (suggestions.length > 0 && selectedIndex < suggestions.length) {
              const product = suggestions[selectedIndex];
              router.push(`/item/${product.id}`);
              onClose?.();
            } else if (query.length < 2 && recentSearches.length > 0) {
              const recentIndex = selectedIndex - suggestions.length;
              if (recentIndex >= 0 && recentIndex < recentSearches.length) {
                handleSearch(recentSearches[recentIndex]);
              }
            }
          } else if (query.trim()) {
            handleSearch(query);
          }
          break;
        case "Escape":
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestions, recentSearches, selectedIndex, query, router, onClose]
  );

  const handleSearch = useCallback((searchQuery: string) => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery.trim());
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setQuery("");
      setIsOpen(false);
      onClose?.();
    }
  }, [router, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const showDropdown = isOpen && (query.length >= 2 || recentSearches.length > 0 || POPULAR_SEARCHES.length > 0);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <form onSubmit={handleSubmit} className="relative">
        <input
          ref={inputRef}
          type="search"
          placeholder="Buscar sets, temas, personajes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          className="w-full pl-11 pr-10 py-2.5 bg-background-secondary border-0 rounded-full text-sm text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-lego-yellow transition-all"
          data-testid="search-input"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden z-50"
          >
            {/* Product Suggestions */}
            {suggestions.length > 0 && (
              <div className="p-2">
                <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider px-3 py-2">
                  Productos
                </p>
                {suggestions.map((product, index) => (
                  <Link
                    key={product.id}
                    href={`/item/${product.id}`}
                    onClick={() => {
                      saveRecentSearch(query);
                      onClose?.();
                    }}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-xl transition-colors",
                      selectedIndex === index ? "bg-background-secondary" : "hover:bg-background-secondary"
                    )}
                    data-testid="search-result"
                  >
                    <div className="relative w-12 h-12 bg-background-secondary rounded-lg flex-shrink-0">
                      <Image
                        src={product.img}
                        alt={product.name}
                        fill
                        className="object-contain p-1"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground-primary line-clamp-1">{product.name}</p>
                      <p className="text-xs text-foreground-muted">{product.theme}</p>
                    </div>
                    <span className="text-sm font-bold text-foreground-primary">
                      {formatPrice(product.price)}
                    </span>
                  </Link>
                ))}

                {/* View All Results */}
                <button
                  onClick={() => handleSearch(query)}
                  className="w-full mt-1 p-3 text-sm font-medium text-lego-blue hover:bg-blue-50 dark:hover:bg-blue-950 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  Ver todos los resultados
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* No Results */}
            {query.length >= 2 && suggestions.length === 0 && (
              <div className="p-6 text-center">
                <p className="text-foreground-secondary">No se encontraron productos para &quot;{query}&quot;</p>
                <p className="text-sm text-foreground-muted mt-1">Intenta con otros términos de búsqueda</p>
              </div>
            )}

            {/* Recent Searches & Popular - Show when not typing */}
            {query.length < 2 && (
              <div className="p-2">
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between px-3 py-2">
                      <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        Búsquedas recientes
                      </p>
                      <button
                        onClick={handleClearRecent}
                        className="text-xs text-foreground-muted hover:text-foreground-secondary"
                      >
                        Borrar
                      </button>
                    </div>
                    {recentSearches.map((search, index) => (
                      <button
                        key={search}
                        onClick={() => handleSearch(search)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-xl text-sm text-foreground-secondary flex items-center gap-2 transition-colors",
                          selectedIndex === index ? "bg-background-secondary" : "hover:bg-background-secondary"
                        )}
                      >
                        <Clock className="w-4 h-4 text-foreground-muted" />
                        {search}
                      </button>
                    ))}
                  </div>
                )}

                {/* Popular Searches */}
                <div>
                  <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider px-3 py-2 flex items-center gap-2">
                    <TrendingUp className="w-3 h-3" />
                    Búsquedas populares
                  </p>
                  <div className="px-3 pb-2 flex flex-wrap gap-2">
                    {POPULAR_SEARCHES.map((term) => (
                      <button
                        key={term}
                        onClick={() => handleSearch(term)}
                        className="px-3 py-1.5 bg-background-secondary hover:bg-background-tertiary rounded-full text-sm text-foreground-secondary transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
