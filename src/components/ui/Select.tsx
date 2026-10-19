"use client";

import * as React from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { controlClasses } from "./Input";
import { useField, useFieldControl } from "./Field";

/**
 * Select on Base UI. Pass `items` to Select so SelectValue can show labels:
 *
 *   <Field label="Ordenar por">
 *     <Select items={options} value={sort} onValueChange={setSort}>
 *       <SelectTrigger><SelectValue /></SelectTrigger>
 *       <SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
 *     </Select>
 *   </Field>
 */
function Select<Value, Multiple extends boolean | undefined = false>({
  required,
  disabled,
  ...props
}: React.ComponentProps<typeof BaseSelect.Root<Value, Multiple>>) {
  // Base UI derives aria-required / native validation on the trigger from the Root,
  // so the Field's `required` and `disabled` are forwarded here.
  const field = useField();
  return (
    <BaseSelect.Root<Value, Multiple>
      required={required ?? (field?.required || undefined)}
      disabled={disabled ?? (field?.disabled || undefined)}
      {...props}
    />
  );
}

interface SelectTriggerProps extends Omit<React.ComponentProps<typeof BaseSelect.Trigger>, "className"> {
  className?: string;
  invalid?: boolean;
  size?: "sm" | "md";
}

function SelectTrigger({ className, children, size = "md", ...props }: SelectTriggerProps) {
  const { field, controlProps } = useFieldControl(props);
  const { required: _required, ...triggerProps } = controlProps as typeof controlProps & { required?: boolean };
  void _required;
  // The trigger is a <button>: axe's button-name ignores label[for], and the value text can be
  // empty before hydration. Inside a Field, name it with "label + current value" explicitly.
  const labelledBy =
    props["aria-labelledby"] ??
    (field && !props["aria-label"] && triggerProps.id ? `${field.labelId} ${triggerProps.id}` : undefined);
  return (
    <BaseSelect.Trigger
      data-slot="select-trigger"
      className={cn(
        controlClasses,
        "group flex items-center justify-between gap-2 px-3.5 text-left select-none",
        size === "md" ? "h-11 text-body" : "h-9 text-sm",
        "data-placeholder:text-fg-muted data-popup-open:border-focus-ring",
        className
      )}
      {...triggerProps}
      aria-labelledby={labelledBy}
    >
      {children}
      <BaseSelect.Icon className="text-fg-muted transition-transform duration-fast group-data-popup-open:rotate-180">
        <ChevronDown aria-hidden="true" className="size-4" />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  );
}

function SelectValue({ className, ...props }: Omit<React.ComponentProps<typeof BaseSelect.Value>, "className"> & { className?: string }) {
  return <BaseSelect.Value data-slot="select-value" className={cn("flex-1 truncate", className)} {...props} />;
}

interface SelectContentProps extends Omit<React.ComponentProps<typeof BaseSelect.Popup>, "className"> {
  className?: string;
  sideOffset?: number;
  alignItemWithTrigger?: boolean;
}

function SelectContent({ className, children, sideOffset = 6, alignItemWithTrigger = false, ...props }: SelectContentProps) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner sideOffset={sideOffset} alignItemWithTrigger={alignItemWithTrigger} className="z-50 outline-none">
        <BaseSelect.Popup
          data-slot="select-content"
          className={cn(
            "max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-xl border border-border bg-surface-raised p-1 text-fg shadow-lg outline-none",
            "transition-[opacity,scale] duration-fast ease-standard data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0",
            className
          )}
          {...props}
        >
          <BaseSelect.List>{children}</BaseSelect.List>
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

function SelectItem({ className, children, ...props }: Omit<React.ComponentProps<typeof BaseSelect.Item>, "className"> & { className?: string }) {
  return (
    <BaseSelect.Item
      data-slot="select-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-lg py-2 pr-8 pl-3 text-sm outline-none select-none",
        "data-highlighted:bg-bg-muted data-highlighted:ring-2 data-highlighted:ring-focus-ring data-highlighted:ring-inset data-selected:font-semibold data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
      <BaseSelect.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center text-fg">
        <Check aria-hidden="true" className="size-4" />
      </BaseSelect.ItemIndicator>
    </BaseSelect.Item>
  );
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
