"use client";

import { m } from "motion/react";
import { CheckCircle, PenLine, ThumbsUp, Trash2 } from "lucide-react";
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

interface ReviewItemProps {
  review: Review;
  /** The signed-in user marked it "útil" (shown pressed). */
  voted?: boolean;
  /** The signed-in user wrote it: no vote, edit and delete instead. */
  mine?: boolean;
  /** The vote cannot be changed yet (the user's votes are still loading). */
  voteDisabled?: boolean;
  /** Asks to mark (true) or unmark the review as "útil". */
  onHelpfulChange: (review: Review, helpful: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * One review in the list, with its "Útil" vote (a toggle: one vote per user,
 * pressed again to take it back). The author's own review offers edit and
 * delete instead. Glides when the list is re-sorted.
 */
export function ReviewItem({
  review,
  voted = false,
  mine = false,
  voteDisabled = false,
  onHelpfulChange,
  onEdit,
  onDelete,
}: ReviewItemProps) {
  return (
    <m.li
      layout="position"
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={transitions.spring}
      // Focusable from script only: "Ver más reseñas" moves focus to the first review it loaded.
      tabIndex={-1}
      className="py-6 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset"
      data-testid="review"
      data-review-id={review.id}
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
            {mine && (
              <Badge variant="neutral" className="normal-case">
                Tu reseña
              </Badge>
            )}
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
          <p className="break-words whitespace-pre-line text-fg-secondary">{review.comment}</p>
          {mine ? (
            <div className="-ml-3 flex flex-wrap items-center gap-1">
              <p className="px-3 text-label font-normal text-fg-muted">Útil ({review.helpful})</p>
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <PenLine aria-hidden="true" />
                Editar
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete} className="hover:text-danger">
                <Trash2 aria-hidden="true" />
                Eliminar
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className={cn("-ml-3", voted && "text-info")}
              onClick={() => onHelpfulChange(review, !voted)}
              aria-pressed={voted}
              disabled={voteDisabled}
              focusableWhenDisabled
            >
              <m.span
                key={voted ? "voted" : "idle"}
                initial={voted ? { scale: 0.6, rotate: -12 } : false}
                animate={{ scale: 1, rotate: 0 }}
                transition={transitions.spring}
                className="inline-flex"
              >
                <ThumbsUp aria-hidden="true" className={cn(voted && "fill-current")} />
              </m.span>
              Útil ({review.helpful})
            </Button>
          )}
        </div>
      </article>
    </m.li>
  );
}
