"use client";

import { Button, type ButtonProps } from "./Button";

export interface IconButtonProps extends Omit<ButtonProps, "aria-label" | "size"> {
  /** Accessible name. Required: icon-only buttons have no visible text. */
  label: string;
  size?: "icon" | "icon-sm";
}

/** Icon-only button. `label` becomes aria-label (and the native tooltip). */
export function IconButton({ label, variant = "ghost", size = "icon", className, title, ...props }: IconButtonProps) {
  return (
    <Button
      aria-label={label}
      title={title ?? label}
      variant={variant}
      size={size}
      className={className ? `rounded-full ${className}` : "rounded-full"}
      {...props}
    />
  );
}
