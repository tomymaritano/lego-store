"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX = 5;

const sizes = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-6",
} as const;

const formatRating = (value: number) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);

export interface RatingProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** 0–5, fractions allowed (drawn as partial stars). */
  value: number;
  /** Number of reviews, shown next to the stars. */
  count?: number;
  /** Also print the numeric value. */
  showValue?: boolean;
  /**
   * No reviews yet: shows "Sin reseñas" instead of empty stars and a 0 that
   * would read as a 0-star rating. Implied by `count={0}`.
   */
  unrated?: boolean;
  size?: keyof typeof sizes;
}

/** Read-only star rating. Exposed to assistive tech as one image with a text label. */
export function Rating({ value, count, showValue = false, unrated = false, size = "md", className, ...props }: RatingProps) {
  if (unrated || count === 0) {
    return (
      <div data-slot="rating" className={cn("inline-flex items-center text-caption text-fg-muted", className)} {...props}>
        Sin reseñas
      </div>
    );
  }
  const clamped = Math.max(0, Math.min(MAX, value));
  const label = `Valoración: ${formatRating(clamped)} de ${MAX}${count !== undefined ? `, ${count} reseñas` : ""}`;

  return (
    <div data-slot="rating" className={cn("inline-flex items-center gap-1.5", className)} {...props}>
      <span role="img" aria-label={label} className="inline-flex">
        {Array.from({ length: MAX }, (_, i) => {
          const fill = Math.max(0, Math.min(1, clamped - i));
          return (
            <span key={i} className={cn("relative inline-block", sizes[size])} aria-hidden="true">
              <Star className={cn("absolute inset-0 fill-bg-muted text-border-strong", sizes[size])} strokeWidth={1.5} />
              {fill > 0 ? (
                <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                  <Star className={cn("fill-rating text-rating", sizes[size])} strokeWidth={1.5} />
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
      {showValue || count !== undefined ? (
        <span aria-hidden="true" className="text-caption text-fg-muted">
          {showValue ? formatRating(clamped) : null}
          {count !== undefined ? ` (${count})` : null}
        </span>
      ) : null}
    </div>
  );
}

export interface RatingInputProps {
  /** Group label (visible legend unless hideLabel). */
  label: string;
  hideLabel?: boolean;
  value: number;
  onValueChange: (value: number) => void;
  /** Native radio group name (useful in forms). Generated when omitted. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  /** Error message; marks the group invalid and is announced. */
  error?: string;
  size?: keyof typeof sizes;
  className?: string;
  /**
   * Ref to the radio that holds the group's tab stop (the checked one, or the
   * first): lets a form library focus the rating when it is invalid.
   */
  inputRef?: React.Ref<HTMLInputElement>;
  /** Fired when focus leaves a radio (form "touched" state). */
  onBlur?: () => void;
}

/**
 * Interactive rating built on native radios: Tab focuses the group, arrow keys
 * change the value, each option is named "N estrellas". Hover previews.
 */
export function RatingInput({
  label,
  hideLabel = false,
  value,
  onValueChange,
  name,
  required,
  disabled,
  error,
  size = "lg",
  className,
  inputRef,
  onBlur,
}: RatingInputProps) {
  const autoId = React.useId();
  const groupName = name ?? `rating-${autoId}`;
  const errorId = error ? `${groupName}-error` : undefined;
  const [hovered, setHovered] = React.useState(0);
  const shown = hovered || value;

  return (
    <fieldset
      data-slot="rating-input"
      className={cn("flex flex-col gap-1.5", className)}
      disabled={disabled}
      // role=radiogroup (not the implicit group) so aria-invalid/aria-required are supported states.
      role="radiogroup"
      aria-invalid={error ? true : undefined}
      aria-required={required || undefined}
      aria-describedby={errorId}
    >
      <legend className={cn("mb-1.5 text-label text-fg", hideLabel && "sr-only")}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        ) : null}
      </legend>
      <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
        {Array.from({ length: MAX }, (_, i) => {
          const option = i + 1;
          const active = option <= shown;
          return (
            <label
              key={option}
              className="group relative cursor-pointer rounded-md has-disabled:cursor-not-allowed"
              onMouseEnter={() => !disabled && setHovered(option)}
            >
              <input
                ref={value === option || (value < 1 && option === 1) ? inputRef : undefined}
                type="radio"
                name={groupName}
                value={option}
                checked={value === option}
                onChange={() => onValueChange(option)}
                onBlur={onBlur}
                required={required}
                aria-describedby={errorId}
                className="peer sr-only"
              />
              <span className="sr-only">{option === 1 ? "1 estrella" : `${option} estrellas`}</span>
              <Star
                aria-hidden="true"
                strokeWidth={1.5}
                className={cn(
                  sizes[size],
                  "rounded-md transition-[color,fill,scale] duration-fast ease-standard",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring",
                  "group-hover:scale-110 motion-reduce:group-hover:scale-100",
                  active ? "fill-rating text-rating" : "fill-transparent text-border-strong"
                )}
              />
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-caption font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
