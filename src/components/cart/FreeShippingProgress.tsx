"use client";

import { m } from "motion/react";
import { PartyPopper, Truck } from "lucide-react";
import { transitions } from "@/lib/motion";
import { quoteShipping } from "@/lib/pricing";
import { cn, formatPrice } from "@/lib/utils";
import { useShippingRules } from "@/providers/ShippingRulesProvider";

/**
 * "Te faltan $X para el envío gratis" with a bar that fills as the subtotal
 * grows. The sentence is a polite live region; the bar is decorative (the
 * text already carries the numbers).
 */
export function FreeShippingProgress({ subtotal, className }: { subtotal: number; className?: string }) {
  const { free, remaining, progress } = quoteShipping(subtotal, useShippingRules());

  return (
    <div className={cn("space-y-2", className)} data-testid="free-shipping">
      <p aria-live="polite" className="flex items-center gap-2 text-label font-normal text-fg-secondary">
        {free ? (
          <>
            <PartyPopper aria-hidden="true" className="size-4 shrink-0 text-success" />
            <span>
              <strong className="font-semibold text-success">¡Tienes envío gratis!</strong>
            </span>
          </>
        ) : (
          <>
            <Truck aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
            <span>
              Te faltan <strong className="font-semibold text-fg tabular-nums">{formatPrice(remaining)}</strong> para el envío
              gratis
            </span>
          </>
        )}
      </p>
      <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-bg-muted">
        <m.div
          className={cn("h-full origin-left rounded-full", free ? "bg-success" : "bg-primary")}
          initial={false}
          animate={{ scaleX: progress }}
          transition={transitions.slow}
          data-progress={progress}
        />
      </div>
    </div>
  );
}
