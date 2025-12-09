"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantitySelectorProps {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  className?: string;
}

export function QuantitySelector({
  quantity,
  onIncrease,
  onDecrease,
  min = 1,
  max = 99,
  size = "md",
  className,
}: QuantitySelectorProps) {
  const sizes = {
    sm: {
      button: "w-7 h-7",
      icon: "w-3 h-3",
      text: "w-8 text-sm",
    },
    md: {
      button: "w-9 h-9",
      icon: "w-4 h-4",
      text: "w-12 text-base",
    },
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        onClick={onDecrease}
        disabled={quantity <= min}
        className={cn(
          "flex items-center justify-center rounded-lg border border-border bg-surface transition-all",
          "hover:bg-background-secondary hover:border-foreground-muted active:scale-95",
          "disabled:opacity-50 disabled:cursor-not-allowed text-foreground-primary",
          sizes[size].button
        )}
        aria-label="Decrease quantity"
      >
        <Minus className={sizes[size].icon} />
      </button>

      <span className={cn("text-center font-medium text-foreground-primary", sizes[size].text)}>{quantity}</span>

      <button
        onClick={onIncrease}
        disabled={quantity >= max}
        className={cn(
          "flex items-center justify-center rounded-lg border border-border bg-surface transition-all",
          "hover:bg-background-secondary hover:border-foreground-muted active:scale-95",
          "disabled:opacity-50 disabled:cursor-not-allowed text-foreground-primary",
          sizes[size].button
        )}
        aria-label="Increase quantity"
      >
        <Plus className={sizes[size].icon} />
      </button>
    </div>
  );
}
