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

function Slider({ className, thumbLabels, formatValueText, value, defaultValue, min = 0, max = 100, disabled, ...props }: SliderProps) {
  // A slider is not label[for]-able: it is named through aria-labelledby.
  const { field } = useFieldControl({}, { labelable: false });
  const isDisabled = disabled ?? field?.disabled ?? false;
  const invalid = field?.invalid ?? false;
  const values = Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [typeof value === "number" ? value : typeof defaultValue === "number" ? defaultValue : min];

  return (
    <BaseSlider.Root
      data-slot="slider"
      value={value}
      defaultValue={defaultValue}
      min={min}
      max={max}
      disabled={isDisabled}
      className={cn("w-full", className)}
      {...props}
    >
      <BaseSlider.Control className="relative flex h-6 w-full touch-none items-center select-none data-disabled:opacity-50">
        {/* Track uses border-strong in both themes: light 4.8:1 on bg; dark 5.19:1 on bg, 4.29:1 on surface (WCAG 1.4.11). */}
        <BaseSlider.Track className="relative h-1.5 w-full rounded-full bg-border-strong">
          <BaseSlider.Indicator className="rounded-full bg-fg dark:bg-primary" />
        </BaseSlider.Track>
        {values.map((_, index) => (
          <BaseSlider.Thumb
            key={index}
            index={index}
            // aria-invalid belongs on the <input type="range">, which Base UI only exposes by ref.
            inputRef={(input: HTMLInputElement | null) => {
              if (!input) return;
              if (invalid) input.setAttribute("aria-invalid", "true");
              else input.removeAttribute("aria-invalid");
            }}
            aria-labelledby={thumbLabels?.[index] ? undefined : field?.labelId}
            aria-describedby={[field?.hintId, field?.errorId].filter(Boolean).join(" ") || undefined}
            getAriaLabel={thumbLabels ? (i) => thumbLabels[i] ?? "" : undefined}
            getAriaValueText={formatValueText ? (_formatted, v) => formatValueText(v) : undefined}
            className={cn(
              "block size-5 rounded-full border-2 border-fg bg-primary shadow-md",
              "transition-[box-shadow,scale] duration-fast ease-standard",
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
