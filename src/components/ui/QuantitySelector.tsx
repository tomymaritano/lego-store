"use client";

import { AnimatePresence, m } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { IconButton } from "./IconButton";

export interface QuantitySelectorProps {
  value: number;
  /** Called with the next value, already clamped to [min, max]. */
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  /** Names the group, e.g. "Cantidad de Millennium Falcon". */
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * − value + stepper. At the bounds the buttons become aria-disabled but stay
 * focusable (focusableWhenDisabled), so keyboard focus is never dropped.
 * The animated digits are aria-hidden; a separate sr-only live region
 * announces only the new value.
 */
export function QuantitySelector({
  value,
  onValueChange,
  min = 1,
  max = 99,
  size = "md",
  label = "Cantidad",
  disabled = false,
  className,
}: QuantitySelectorProps) {
  const set = (next: number) => onValueChange(Math.min(max, Math.max(min, next)));
  const buttonSize = size === "sm" ? "icon-sm" : "icon";

  return (
    <div
      role="group"
      aria-label={label}
      data-slot="quantity-selector"
      className={cn("inline-flex items-center rounded-full border border-border bg-surface p-0.5", className)}
    >
      <IconButton
        label="Disminuir cantidad"
        size={buttonSize}
        variant="ghost"
        onClick={() => set(value - 1)}
        disabled={disabled || value <= min}
        focusableWhenDisabled
      >
        <Minus aria-hidden="true" />
      </IconButton>
      <span
        aria-hidden="true"
        className={cn(
          "relative flex justify-center overflow-hidden font-semibold text-fg tabular-nums",
          size === "sm" ? "w-7 text-sm" : "w-10 text-base"
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={value}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={transitions.fast}
          >
            {value}
          </m.span>
        </AnimatePresence>
      </span>
      <output aria-live="polite" aria-atomic="true" className="sr-only">
        {value}
      </output>
      <IconButton
        label="Aumentar cantidad"
        size={buttonSize}
        variant="ghost"
        onClick={() => set(value + 1)}
        disabled={disabled || value >= max}
        focusableWhenDisabled
      >
        <Plus aria-hidden="true" />
      </IconButton>
    </div>
  );
}
