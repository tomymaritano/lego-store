"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useFieldControl } from "./Field";

/** Shared look for text-like controls (Input, Textarea, SelectTrigger). */
export const controlClasses = cn(
  "w-full rounded-lg border border-border-strong bg-surface text-fg",
  "transition-[border-color,box-shadow] duration-fast ease-standard",
  "placeholder:text-fg-muted",
  "outline-none focus-visible:border-focus-ring focus-visible:ring-2 focus-visible:ring-focus-ring/40",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/30"
);

export interface InputProps extends React.ComponentProps<"input"> {
  /** Marks the control invalid without a Field (Field sets this itself). */
  invalid?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

function Input({ className, type = "text", leftIcon, rightIcon, ...props }: InputProps) {
  const { controlProps } = useFieldControl(props);
  const input = (
    <input
      type={type}
      data-slot="input"
      className={cn(controlClasses, "h-11 px-3.5 text-body", leftIcon && "pl-10", rightIcon && "pr-10", className)}
      {...controlProps}
    />
  );

  if (!leftIcon && !rightIcon) return input;

  return (
    <div className="relative">
      {leftIcon ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-fg-muted [&_svg]:size-4">
          {leftIcon}
        </span>
      ) : null}
      {input}
      {rightIcon ? (
        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-fg-muted [&_svg]:size-4">{rightIcon}</span>
      ) : null}
    </div>
  );
}

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  invalid?: boolean;
}

function Textarea({ className, rows = 4, ...props }: TextareaProps) {
  const { controlProps } = useFieldControl(props);
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(controlClasses, "min-h-24 resize-y px-3.5 py-2.5 text-body", className)}
      {...controlProps}
    />
  );
}

export { Input, Textarea };
