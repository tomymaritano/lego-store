import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { calculateDiscount, cn, formatPrice } from "@/lib/utils";
import { Badge } from "./Badge";

const priceVariants = cva("font-bold text-fg tabular-nums", {
  variants: {
    size: {
      sm: "text-base",
      md: "text-xl",
      lg: "text-3xl",
    },
  },
  defaultVariants: { size: "md" },
});

export interface PriceProps extends Omit<React.ComponentProps<"div">, "children">, VariantProps<typeof priceVariants> {
  value: number;
  /** Price before the discount. Ignored unless higher than `value`. */
  originalValue?: number;
  /** Show the "-N%" badge when discounted. */
  showDiscount?: boolean;
}

/** Current price, struck-through original and discount, read correctly by screen readers. */
export function Price({ value, originalValue, showDiscount = false, size, className, ...props }: PriceProps) {
  const discounted = originalValue !== undefined && originalValue > value;
  const discount = discounted ? calculateDiscount(originalValue, value) : 0;

  return (
    <div data-slot="price" className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)} {...props}>
      <span className={priceVariants({ size })}>
        {discounted ? <span className="sr-only">Precio actual: </span> : null}
        {formatPrice(value)}
      </span>
      {discounted ? (
        <>
          <del className={cn("text-fg-muted tabular-nums", size === "lg" ? "text-lg" : "text-sm")}>
            <span className="sr-only">Precio anterior: </span>
            {formatPrice(originalValue)}
          </del>
          {showDiscount ? (
            <Badge variant="sale" className="self-center">
              <span className="sr-only">Descuento de </span>-{discount}%
            </Badge>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
