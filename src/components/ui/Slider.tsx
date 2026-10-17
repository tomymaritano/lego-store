"use client";

import * as React from "react";
import { Slider as BaseSlider } from "@base-ui/react/slider";
import { cn } from "@/lib/utils";
import { useFieldControl } from "./Field";

export interface SliderProps extends Omit<React.ComponentProps<typeof BaseSlider.Root>, "className"> {
  className?: string;
  /**
   * Accessible names for each thumb, e.g. ["Precio mínimo", "Precio máximo"].
   * Needed for range sliders; a single thumb inside a Field uses the Field label.
   */
  thumbLabels?: string[];
  /** Formats the value read by screen readers, e.g. formatPrice. */
  formatValueText?: (value: number) => string;
}

function Slider({ className, thumbLabels, formatValueText, value, defaultValue, min = 0, max = 100, ...props }: SliderProps) {
  const { field } = useFieldControl({});
  const values = Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [typeof value === "number" ? value : typeof defaultValue === "number" ? defaultValue : min];

  return (
    <BaseSlider.Root
      data-slot="slider"
      value={value}
      defaultValue={defaultValue}
      min={min}
      max={max}
      className={cn("w-full", className)}
      {...props}
    >
      <BaseSlider.Control className="relative flex h-6 w-full touch-none items-center select-none data-disabled:opacity-50">
        <BaseSlider.Track className="relative h-1.5 w-full rounded-full bg-bg-muted">
          <BaseSlider.Indicator className="rounded-full bg-primary" />
        </BaseSlider.Track>
        {values.map((_, index) => (
          <BaseSlider.Thumb
            key={index}
            index={index}
            aria-labelledby={thumbLabels?.[index] ? undefined : field?.labelId}
            aria-describedby={[field?.hintId, field?.errorId].filter(Boolean).join(" ") || undefined}
            getAriaLabel={thumbLabels ? (i) => thumbLabels[i] ?? "" : undefined}
            getAriaValueText={formatValueText ? (_formatted, v) => formatValueText(v) : undefined}
            className={cn(
              "block size-5 rounded-full border-2 border-fg bg-primary shadow-md",
              "transition-[box-shadow,transform] duration-fast ease-standard",
              "outline-none has-focus-visible:ring-2 has-focus-visible:ring-focus-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-bg",
              "hover:scale-110 data-dragging:scale-110 motion-reduce:hover:scale-100"
            )}
          />
        ))}
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}

export { Slider };
