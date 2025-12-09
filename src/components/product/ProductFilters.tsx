"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X, ChevronDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

export interface FilterState {
  priceRange: [number, number];
  themes: string[];
  rating: number | null;
  inStock: boolean;
  onSale: boolean;
}

interface ProductFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  availableThemes: string[];
  priceRange: [number, number];
  productCount: number;
}

const defaultFilters: FilterState = {
  priceRange: [0, 50000],
  themes: [],
  rating: null,
  inStock: false,
  onSale: false,
};

export function ProductFilters({
  filters,
  onFilterChange,
  availableThemes,
  priceRange,
  productCount,
}: ProductFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(["price", "theme"]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const handlePriceChange = (type: "min" | "max", value: number) => {
    const newRange: [number, number] =
      type === "min" ? [value, filters.priceRange[1]] : [filters.priceRange[0], value];
    onFilterChange({ ...filters, priceRange: newRange });
  };

  const handleThemeToggle = (theme: string) => {
    const newThemes = filters.themes.includes(theme)
      ? filters.themes.filter((t) => t !== theme)
      : [...filters.themes, theme];
    onFilterChange({ ...filters, themes: newThemes });
  };

  const handleRatingChange = (rating: number | null) => {
    onFilterChange({ ...filters, rating: filters.rating === rating ? null : rating });
  };

  const clearFilters = () => {
    onFilterChange({ ...defaultFilters, priceRange });
  };

  const hasActiveFilters =
    filters.themes.length > 0 ||
    filters.rating !== null ||
    filters.inStock ||
    filters.onSale ||
    filters.priceRange[0] > priceRange[0] ||
    filters.priceRange[1] < priceRange[1];

  return (
    <>
      {/* Mobile Filter Button */}
      <div className="lg:hidden mb-4">
        <Button
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <span className="bg-lego-yellow text-lego-black text-xs font-bold px-2 py-0.5 rounded-full">
                {filters.themes.length + (filters.rating ? 1 : 0) + (filters.inStock ? 1 : 0) + (filters.onSale ? 1 : 0)}
              </span>
            )}
          </span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>

      {/* Mobile Filter Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed inset-y-0 left-0 w-80 bg-white z-50 shadow-xl lg:hidden overflow-auto"
            >
              <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
                <h2 className="font-bold text-lg">Filtros</h2>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <FilterContent
                  filters={filters}
                  onFilterChange={onFilterChange}
                  availableThemes={availableThemes}
                  priceRange={priceRange}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  handlePriceChange={handlePriceChange}
                  handleThemeToggle={handleThemeToggle}
                  handleRatingChange={handleRatingChange}
                />
              </div>
              <div className="p-4 border-t sticky bottom-0 bg-white">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={clearFilters} className="flex-1">
                    Limpiar
                  </Button>
                  <Button onClick={() => setIsOpen(false)} className="flex-1">
                    Ver {productCount} productos
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-24 bg-white rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5" />
              Filtros
            </h2>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-lego-blue hover:underline"
              >
                Limpiar
              </button>
            )}
          </div>
          <FilterContent
            filters={filters}
            onFilterChange={onFilterChange}
            availableThemes={availableThemes}
            priceRange={priceRange}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            handlePriceChange={handlePriceChange}
            handleThemeToggle={handleThemeToggle}
            handleRatingChange={handleRatingChange}
          />
        </div>
      </div>
    </>
  );
}

interface FilterContentProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  availableThemes: string[];
  priceRange: [number, number];
  expandedSections: string[];
  toggleSection: (section: string) => void;
  handlePriceChange: (type: "min" | "max", value: number) => void;
  handleThemeToggle: (theme: string) => void;
  handleRatingChange: (rating: number | null) => void;
}

function FilterContent({
  filters,
  onFilterChange,
  availableThemes,
  priceRange,
  expandedSections,
  toggleSection,
  handlePriceChange,
  handleThemeToggle,
  handleRatingChange,
}: FilterContentProps) {
  return (
    <div className="space-y-4">
      {/* Quick Filters */}
      <div className="space-y-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.onSale}
            onChange={(e) => onFilterChange({ ...filters, onSale: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-lego-yellow focus:ring-lego-yellow"
          />
          <span className="text-sm">En oferta</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.inStock}
            onChange={(e) => onFilterChange({ ...filters, inStock: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-lego-yellow focus:ring-lego-yellow"
          />
          <span className="text-sm">En stock</span>
        </label>
      </div>

      <hr />

      {/* Price Range */}
      <FilterSection
        title="Precio"
        isExpanded={expandedSections.includes("price")}
        onToggle={() => toggleSection("price")}
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Mínimo</label>
              <input
                type="number"
                value={filters.priceRange[0]}
                onChange={(e) => handlePriceChange("min", Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                min={priceRange[0]}
                max={filters.priceRange[1]}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Máximo</label>
              <input
                type="number"
                value={filters.priceRange[1]}
                onChange={(e) => handlePriceChange("max", Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                min={filters.priceRange[0]}
                max={priceRange[1]}
              />
            </div>
          </div>
          <input
            type="range"
            min={priceRange[0]}
            max={priceRange[1]}
            value={filters.priceRange[1]}
            onChange={(e) => handlePriceChange("max", Number(e.target.value))}
            className="w-full accent-lego-yellow"
          />
        </div>
      </FilterSection>

      {/* Themes */}
      <FilterSection
        title="Temas"
        isExpanded={expandedSections.includes("theme")}
        onToggle={() => toggleSection("theme")}
      >
        <div className="space-y-2 max-h-48 overflow-auto">
          {availableThemes.map((theme) => (
            <label key={theme} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.themes.includes(theme)}
                onChange={() => handleThemeToggle(theme)}
                className="w-4 h-4 rounded border-gray-300 text-lego-yellow focus:ring-lego-yellow"
              />
              <span className="text-sm">{theme}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Rating */}
      <FilterSection
        title="Calificación"
        isExpanded={expandedSections.includes("rating")}
        onToggle={() => toggleSection("rating")}
      >
        <div className="space-y-2">
          {[4, 3, 2, 1].map((rating) => (
            <button
              key={rating}
              onClick={() => handleRatingChange(rating)}
              className={cn(
                "flex items-center gap-2 w-full p-2 rounded-lg transition-colors text-sm",
                filters.rating === rating ? "bg-lego-yellow/20" : "hover:bg-gray-100"
              )}
            >
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "w-4 h-4",
                      i < rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"
                    )}
                  />
                ))}
              </div>
              <span className="text-gray-600">y más</span>
            </button>
          ))}
        </div>
      </FilterSection>
    </div>
  );
}

interface FilterSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function FilterSection({ title, isExpanded, onToggle, children }: FilterSectionProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full py-2 font-medium text-sm"
      >
        {title}
        <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="py-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
