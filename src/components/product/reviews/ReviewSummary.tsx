"use client";

import { m } from "motion/react";
import { transitions } from "@/lib/motion";
import { pluralize } from "@/lib/utils";
import type { Review } from "@/types";
import { Rating } from "@/components/ui";

/** Average rating and the 5-to-1 star histogram (bars grow in when scrolled into view). */
export function ReviewSummary({ reviews }: { reviews: readonly Review[] }) {
  const total = reviews.length;
  const average = total === 0 ? 0 : Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / total) * 10) / 10;
  const distribution = [5, 4, 3, 2, 1].map((rating) => {
    const count = reviews.filter((r) => r.rating === rating).length;
    return { rating, count, share: total > 0 ? count / total : 0 };
  });

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
                whileInView={{ scaleX: share }}
                viewport={{ once: true }}
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
