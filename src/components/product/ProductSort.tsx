"use client";

import { SORT_OPTIONS } from "@/lib/productQuery";
import { cn } from "@/lib/utils";
import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import type { SortOption } from "@/types";

interface ProductSortProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  className?: string;
}

/** "Ordenar por" select (options and labels from lib/productQuery). */
export function ProductSort({ value, onChange, className }: ProductSortProps) {
  return (
    <Field label="Ordenar por" className={cn("w-full sm:w-56", className)}>
      <Select items={SORT_OPTIONS} value={value} onValueChange={(next) => next && onChange(next as SortOption)}>
        <SelectTrigger data-testid="product-sort">
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
  );
}
