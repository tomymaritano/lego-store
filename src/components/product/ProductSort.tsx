"use client";

import { SORT_OPTIONS } from "@/lib/productQuery";
import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import type { SortOption } from "@/types";

interface ProductSortProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  productCount: number;
}

/** Result count + sort select (options and labels from lib/productQuery). */
export function ProductSort({ value, onChange, productCount }: ProductSortProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <p className="text-sm text-fg-secondary" aria-live="polite">
        <span className="font-semibold text-fg">{productCount}</span> {productCount === 1 ? "producto" : "productos"}
      </p>

      <Field label="Ordenar por" className="w-60">
        <Select items={SORT_OPTIONS} value={value} onValueChange={(next) => next && onChange(next as SortOption)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
