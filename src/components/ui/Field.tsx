"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface FieldContextValue {
  controlId: string;
  labelId: string;
  hintId?: string;
  errorId?: string;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
}

const FieldContext = React.createContext<FieldContextValue | null>(null);

export interface FieldProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: React.ReactNode;
  /** Helper text shown under the control. */
  hint?: React.ReactNode;
  /** Error message. When present the control gets aria-invalid. */
  error?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  /** Id for the control (the label points at it). Generated when omitted. */
  id?: string;
  children: React.ReactNode;
}

/**
 * Label + control + hint + error, wired for assistive tech:
 * label[for] -> control id, aria-describedby -> hint/error, aria-invalid on error.
 * Controls (Input, Textarea, SelectTrigger, RadioGroup, Slider) read the wiring
 * from context through `useFieldControl`.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  disabled = false,
  hideLabel = false,
  id,
  className,
  children,
  ...props
}: FieldProps) {
  const autoId = React.useId();
  const controlId = id ?? `field-${autoId}`;
  const value: FieldContextValue = {
    controlId,
    labelId: `${controlId}-label`,
    hintId: hint ? `${controlId}-hint` : undefined,
    errorId: error ? `${controlId}-error` : undefined,
    invalid: Boolean(error),
    required,
    disabled,
  };

  return (
    <FieldContext.Provider value={value}>
      <div data-slot="field" data-invalid={value.invalid || undefined} className={cn("flex flex-col gap-1.5", className)} {...props}>
        <label
          id={value.labelId}
          htmlFor={controlId}
          className={cn("text-label text-fg", disabled && "opacity-60", hideLabel && "sr-only")}
        >
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-0.5 text-danger">
              *
            </span>
          ) : null}
        </label>
        {children}
        {hint ? (
          <p id={value.hintId} className="text-caption text-fg-muted">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={value.errorId} role="alert" className="text-caption font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

export interface FieldControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  required?: boolean;
  disabled?: boolean;
}

/**
 * Merges a control's own props with the surrounding Field's wiring.
 * Outside a Field it returns the props unchanged.
 */
export function useFieldControl<P extends FieldControlProps>(props: P & { invalid?: boolean }) {
  const field = React.useContext(FieldContext);
  const { invalid, ...rest } = props;
  const describedBy =
    [props["aria-describedby"], field?.hintId, field?.errorId].filter(Boolean).join(" ") || undefined;
  const isInvalid = invalid || field?.invalid || props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return {
    field,
    controlProps: {
      ...rest,
      // Inside a Field the Field owns the id (pass `id` to Field), so label[for] always matches.
      id: field?.controlId ?? props.id,
      "aria-describedby": describedBy,
      "aria-invalid": isInvalid || undefined,
      required: props.required ?? (field?.required || undefined),
      disabled: props.disabled ?? (field?.disabled || undefined),
    } as Omit<P, "invalid">,
  };
}
