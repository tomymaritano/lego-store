"use client";

import * as React from "react";
import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { cn } from "@/lib/utils";
import { useFieldControl } from "./Field";

export interface RadioGroupProps extends Omit<React.ComponentProps<typeof BaseRadioGroup>, "className"> {
  className?: string;
  invalid?: boolean;
}

/**
 * Radio group on Base UI (arrow-key navigation, roving focus). Inside a Field
 * the group is labelled by the Field label and described by its hint/error.
 */
function RadioGroup({ className, ...props }: RadioGroupProps) {
  // A group is not label[for]-able: the Field label names it via aria-labelledby.
  const { field, controlProps } = useFieldControl(props, { labelable: false });
  const { id: _id, required: _required, ...groupProps } = controlProps as typeof controlProps & { id?: string; required?: boolean };
  void _id;
  void _required;
  return (
    <BaseRadioGroup
      data-slot="radio-group"
      aria-labelledby={props["aria-labelledby"] ?? field?.labelId}
      className={cn("grid gap-3", className)}
      {...groupProps}
    />
  );
}

export interface RadioGroupItemProps extends Omit<React.ComponentProps<typeof BaseRadio.Root>, "className"> {
  className?: string;
  label: React.ReactNode;
  description?: React.ReactNode;
}

function RadioGroupItem({ className, label, description, ...props }: RadioGroupItemProps) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-body text-fg has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50", className)}>
      <BaseRadio.Root
        data-slot="radio-group-item"
        className={cn(
          "relative mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-border-strong bg-surface",
          "transition-[border-color,box-shadow] duration-fast ease-standard",
          "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "data-checked:border-fg after:absolute after:-inset-2"
        )}
        {...props}
      >
        <BaseRadio.Indicator
          keepMounted
          className="size-2.5 rounded-full bg-fg transition-[opacity,transform] duration-fast ease-standard data-unchecked:scale-0 data-unchecked:opacity-0"
        />
      </BaseRadio.Root>
      <span className="flex flex-col">
        <span>{label}</span>
        {description ? <span className="text-caption text-fg-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export { RadioGroup, RadioGroupItem };
