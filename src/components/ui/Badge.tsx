import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "new" | "sale" | "limited" | "exclusive" | "success" | "warning";
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const variants = {
    default: "bg-background-secondary text-foreground-primary",
    new: "bg-lego-blue text-white shadow-sm",
    sale: "bg-lego-red text-white shadow-sm",
    limited: "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm",
    exclusive: "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm",
    success: "bg-status-success text-white shadow-sm",
    warning: "bg-status-warning text-white shadow-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide transition-transform hover:scale-105",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
