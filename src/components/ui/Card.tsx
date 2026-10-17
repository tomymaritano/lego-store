import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-2xl border border-border bg-surface text-fg", {
  variants: {
    elevation: {
      flat: "",
      raised: "shadow-card",
    },
    /** Hover lift for clickable cards (CSS, so it also works in Server Components). */
    interactive: {
      true: "transition-[translate,box-shadow] duration-base ease-standard hover:-translate-y-1 hover:shadow-lg focus-within:shadow-lg motion-reduce:hover:translate-y-0",
      false: "",
    },
  },
  defaultVariants: { elevation: "raised", interactive: false },
});

export interface CardProps extends React.ComponentProps<"div">, VariantProps<typeof cardVariants> {}

function Card({ className, elevation, interactive, ...props }: CardProps) {
  return <div data-slot="card" className={cn(cardVariants({ elevation, interactive }), className)} {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-1.5 p-5 pb-0", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("text-title text-fg", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-sm text-fg-muted", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-5", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center gap-3 p-5 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants };
