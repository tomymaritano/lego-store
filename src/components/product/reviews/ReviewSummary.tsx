"use client";

import { m } from "motion/react";
import { transitions } from "@/lib/motion";
import { pluralize } from "@/lib/utils";
import type { ReviewSummary as Summary } from "@/types";
import { Rating } from "@/components/ui";

/**
 * Average rating and the 5-to-1 star histogram over all of the product's
 * reviews (computed on the server, not from the loaded page). Bars grow in
 * when mounted and follow later changes. Not whileInView: the summary
 * usually mounts inside the reviews tab panel while it is hidden
 * (display: none), and the bars must not stay empty if the in-view
 * observer never fires for it.
 */
export function ReviewSummary({ summary }: { summary: Summary }) {
  const { average, count: total } = summary;
  const distribution = summary.distribution.map(({ rating, count }) => ({
    rating,
    count,
    share: total > 0 ? count / total : 0,
  }));

  return (
    <div className="grid gap-8 rounded-2xl border border-border bg-bg-subtle p-6 md:grid-cols-[auto_1fr] md:gap-12">
      <div className="flex flex-col items-center gap-2 md:items-start">
        <p className="text-display font-bold tabular-nums">
          {average.toLocaleString("es-AR")}
          <span className="sr-only"> de 5</span>
        </p>
        <Rating value={average} size="lg" />
        <p className="text-label font-normal text-fg-muted">Basado en {pluralize(total, "reseña")}</p>
      </div>

      <ul className="space-y-2 self-center" aria-label="Distribución de valoraciones">
        {distribution.map(({ rating, count, share }) => (
          <li key={rating} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-label font-normal text-fg-secondary">{pluralize(rating, "estrella")}</span>
            <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-bg-muted">
              <m.span
                className="block h-full origin-left rounded-full bg-rating"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: share }}
                transition={transitions.slow}
              />
            </span>
            <span className="w-8 text-right text-label font-normal text-fg-muted tabular-nums">
              {count}
              <span className="sr-only"> {count === 1 ? "reseña" : "reseñas"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
