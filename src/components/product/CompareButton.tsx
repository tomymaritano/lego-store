"use client";

import { Scale } from "lucide-react";
import { useProductActions } from "@/hooks/useProductActions";
import { IconButton } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/types";

interface CompareButtonProps {
  product: ProductSummary;
  size?: "sm" | "md";
  className?: string;
}

/** Toggle a product in the comparison (max 4), with the shared toast copy. */
export function CompareButton({ product, size = "md", className }: CompareButtonProps) {
  const { inCompare, toggleCompare } = useProductActions(product);

  return (
    <IconButton
      label={inCompare ? `Quitar ${product.name} de la comparación` : `Comparar ${product.name}`}
      aria-pressed={inCompare}
      variant="secondary"
      size={size === "sm" ? "icon-sm" : "icon"}
      onClick={toggleCompare}
      className={cn("shadow-md", inCompare && "border-info text-info", className)}
    >
      <Scale aria-hidden="true" />
    </IconButton>
  );
}
