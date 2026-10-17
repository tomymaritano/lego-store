import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Every variant pairs a fill with its on-colour token (>= 4.5:1, checked in tests). */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-bold tracking-wide uppercase whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "bg-badge-neutral text-fg",
        new: "bg-info text-on-info",
        sale: "bg-sale text-on-sale",
        limited: "bg-badge-limited text-on-badge-limited",
        exclusive: "bg-badge-exclusive text-on-badge-exclusive",
        success: "bg-success text-on-success",
        warning: "bg-warning text-on-warning",
        danger: "bg-danger text-on-danger",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
