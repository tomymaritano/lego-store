"use client";

import * as React from "react";
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<React.ComponentProps<typeof BaseCheckbox.Root>, "className"> {
  className?: string;
  /** Visible label. When given, the checkbox and text are wrapped in a <label>. */
  label?: React.ReactNode;
  /** Secondary text under the label. */
  description?: React.ReactNode;
}

const boxClasses = cn(
  "peer relative flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-border-strong bg-surface text-on-primary",
  "transition-[background-color,border-color,box-shadow] duration-fast ease-standard",
  "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
  "data-checked:border-fg data-checked:bg-primary data-indeterminate:border-fg data-indeterminate:bg-primary",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50",
  // Larger hit area without changing the visual size.
  "after:absolute after:-inset-2"
);

function Checkbox({ className, label, description, indeterminate, ...props }: CheckboxProps) {
  const box = (
    <BaseCheckbox.Root data-slot="checkbox" indeterminate={indeterminate} className={cn(boxClasses, !label && className)} {...props}>
      <BaseCheckbox.Indicator
        keepMounted
        className="flex transition-[opacity,transform] duration-fast ease-standard data-unchecked:scale-50 data-unchecked:opacity-0"
      >
        {indeterminate ? (
          <Minus aria-hidden="true" className="size-3.5" strokeWidth={3} />
        ) : (
          <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
        )}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );

  if (!label) return box;

  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-body text-fg has-data-disabled:cursor-not-allowed", className)}>
      <span className="mt-0.5 flex">{box}</span>
      <span className="flex flex-col">
        <span>{label}</span>
        {description ? <span className="text-caption text-fg-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export { Checkbox };
