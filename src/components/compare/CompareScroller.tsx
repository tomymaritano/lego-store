"use client";

import type { ReactNode } from "react";
import { useScrollEdges } from "@/hooks/useScrollEdges";
import { cn } from "@/lib/utils";

/**
 * The compare table's horizontal scroller (a focusable, named region so the
 * keyboard can scroll it). While columns continue past the right edge, a fade
 * marks the cut as "more to see" rather than overflow. The left edge needs no
 * fade: the sticky label column covers what scrolls under it.
 */
export function CompareScroller({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  const [ref, edges] = useScrollEdges<HTMLDivElement>();

  return (
    <div className="relative">
      <div
        ref={ref}
        role="region"
        aria-labelledby={labelledBy}
        tabIndex={0}
        className="overflow-x-auto overscroll-x-contain rounded-2xl border border-border bg-surface shadow-card focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
        data-testid="compare-scroller"
        data-more-end={edges.end || undefined}
      >
        {children}
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-px right-px z-30 w-12 rounded-r-2xl bg-linear-to-l from-surface to-transparent",
          "transition-opacity duration-base ease-standard",
          edges.end ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
