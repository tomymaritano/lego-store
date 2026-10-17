"use client";

import { useState } from "react";
import { m } from "motion/react";
import { CheckCircle, ThumbsUp } from "lucide-react";
import { fadeInUp, transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Review } from "@/types";
import { Badge, Button, Rating } from "@/components/ui";

/** Dates are stored as YYYY-MM-DD; formatted in UTC so the day never shifts with the visitor's zone. */
const dateFormat = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const formatReviewDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? date : dateFormat.format(parsed);
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

/** One review in the list, with a one-time "Útil" vote. Glides when the list is re-sorted. */
export function ReviewItem({ review, onMarkHelpful }: { review: Review; onMarkHelpful: (id: string) => void }) {
  const [hasMarked, setHasMarked] = useState(false);

  const handleHelpful = () => {
    if (hasMarked) return;
    onMarkHelpful(review.id);
    setHasMarked(true);
  };

  return (
    <m.li
      layout="position"
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={transitions.spring}
      className="py-6"
      data-testid="review"
    >
      <article className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bg-muted text-label font-bold text-fg-secondary"
        >
          {initials(review.userName)}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{review.userName}</span>
            {review.verified && (
              <Badge variant="success" className="normal-case">
                <CheckCircle aria-hidden="true" />
                Compra verificada
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Rating value={review.rating} />
            <time dateTime={review.date} className="text-label font-normal text-fg-muted">
              {formatReviewDate(review.date)}
            </time>
          </div>
          <h3 className="text-body font-semibold">{review.title}</h3>
          <p className="text-fg-secondary">{review.comment}</p>
          <Button
            variant="ghost"
            size="sm"
            className={cn("-ml-3", hasMarked && "text-info")}
            onClick={handleHelpful}
            disabled={hasMarked}
            focusableWhenDisabled
            aria-pressed={hasMarked}
          >
            <m.span
              key={hasMarked ? "voted" : "idle"}
              initial={hasMarked ? { scale: 0.6, rotate: -12 } : false}
              animate={{ scale: 1, rotate: 0 }}
              transition={transitions.spring}
              className="inline-flex"
            >
              <ThumbsUp aria-hidden="true" className={cn(hasMarked && "fill-current")} />
            </m.span>
            Útil ({review.helpful})
          </Button>
        </div>
      </article>
    </m.li>
  );
}
