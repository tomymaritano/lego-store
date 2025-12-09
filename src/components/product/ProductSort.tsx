"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortOption =
  | "featured"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "rating"
  | "name-asc"
  | "name-desc";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "featured", label: "Destacados" },
  { value: "newest", label: "Más nuevos" },
  { value: "price-asc", label: "Precio: menor a mayor" },
  { value: "price-desc", label: "Precio: mayor a menor" },
  { value: "rating", label: "Mejor calificados" },
  { value: "name-asc", label: "Nombre: A-Z" },
  { value: "name-desc", label: "Nombre: Z-A" },
];

interface ProductSortProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  productCount: number;
}

export function ProductSort({ value, onChange, productCount }: ProductSortProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = sortOptions.find((opt) => opt.value === value);

  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      <p className="text-sm text-gray-600">
        <span className="font-semibold text-gray-900">{productCount}</span> productos
      </p>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-white border rounded-xl hover:border-gray-400 transition-colors text-sm"
        >
          <ArrowUpDown className="w-4 h-4 text-gray-500" />
          <span className="hidden sm:inline">Ordenar por:</span>
          <span className="font-medium">{selectedOption?.label}</span>
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border z-20 py-2"
              >
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors",
                      value === option.value && "bg-lego-yellow/10 text-lego-black font-medium"
                    )}
                  >
                    {option.label}
                    {value === option.value && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
