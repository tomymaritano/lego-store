"use client";

import { useState } from "react";
import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  /** Search param name: the value travels in a hidden input, so a plain GET form submits it. */
  name: string;
  label: string;
  options: FilterOption[];
  defaultValue: string;
  className?: string;
}

/** The design system's Select inside a native GET filter form (admin lists). The "" option means "all". */
export function FilterSelect({ name, label, options, defaultValue, className }: FilterSelectProps) {
  const [value, setValue] = useState(defaultValue);
  const items = Object.fromEntries(options.map((option) => [option.value, option.label]));
  return (
    <Field label={label} className={className}>
      <Select items={items} value={value} onValueChange={(next) => setValue(typeof next === "string" ? next : "")}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={value} />
    </Field>
  );
}
