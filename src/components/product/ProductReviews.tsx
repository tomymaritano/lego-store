"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle, MessageSquare, ThumbsUp, User } from "lucide-react";
import { collapse, fadeInUp, transitions } from "@/lib/motion";
import { cn, pluralize } from "@/lib/utils";
import { useReviewStore } from "@/stores/reviewStore";
import type { Review } from "@/types";
import { Badge, Button, Field, Input, Rating, RatingInput, Textarea } from "@/components/ui";

interface ProductReviewsProps {
  productId: string;
}

const reviewCount = (n: number) => pluralize(n, "reseña");

/** Reviews for one product: summary, rating distribution, list and a form to add one. */
export function ProductReviews({ productId }: ProductReviewsProps) {
  const [showForm, setShowForm] = useState(false);
  const allReviews = useReviewStore((state) => state.reviews);
  const markHelpful = useReviewStore((state) => state.markHelpful);

  const reviews = useMemo(() => allReviews.filter((r) => r.productId === productId), [allReviews, productId]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }, [reviews]);

  const distribution = [5, 4, 3, 2, 1].map((rating) => {
    const count = reviews.filter((r) => r.rating === rating).length;
    return { rating, count, percentage: reviews.length > 0 ? (count / reviews.length) * 100 : 0 };
  });

  return (
    <section aria-labelledby="reviews-title" className="border-t border-border py-12">
      <div className="container-custom space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="reviews-title" className="text-title">
              Reseñas de clientes
            </h2>
            <p className="text-fg-muted">{reviewCount(reviews.length)}</p>
          </div>
          <Button
            variant={showForm ? "secondary" : "primary"}
            onClick={() => setShowForm((open) => !open)}
            aria-expanded={showForm}
            aria-controls="review-form"
          >
            {showForm ? "Cancelar" : "Escribir reseña"}
          </Button>
        </div>

        <AnimatePresence initial={false}>
          {showForm && (
            <motion.div key="review-form" variants={collapse} initial="hidden" animate="visible" exit="exit" className="overflow-hidden">
              <ReviewForm productId={productId} onClose={() => setShowForm(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-8 rounded-2xl border border-border bg-bg-subtle p-6 md:grid-cols-2">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <p className="text-5xl font-bold tabular-nums">{averageRating || "–"}</p>
            <Rating value={averageRating} size="lg" />
            <p className="text-sm text-fg-muted">Basado en {reviewCount(reviews.length)}</p>
          </div>

          <ul className="space-y-2" aria-label="Distribución de valoraciones">
            {distribution.map(({ rating, count, percentage }) => (
              <li key={rating} className="flex items-center gap-3">
                <span className="w-20 text-sm text-fg-secondary">{pluralize(rating, "estrella")}</span>
                <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-bg-muted">
                  <motion.span
                    className="block h-full rounded-full bg-rating"
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={transitions.slow}
                  />
                </span>
                <span className="w-8 text-right text-sm text-fg-muted tabular-nums">
                  {count}
                  <span className="sr-only"> {count === 1 ? "reseña" : "reseñas"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {reviews.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-12 text-center text-fg-muted">
            <MessageSquare aria-hidden="true" className="mb-2 size-8" />
            <p>Aún no hay reseñas para este producto.</p>
            <p className="text-sm">¡Sé el primero en dejar tu opinión!</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {reviews.map((review) => (
                <ReviewItem key={review.id} review={review} onMarkHelpful={markHelpful} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}

function ReviewItem({ review, onMarkHelpful }: { review: Review; onMarkHelpful: (id: string) => void }) {
  const [hasMarked, setHasMarked] = useState(false);

  const handleHelpful = () => {
    if (hasMarked) return;
    onMarkHelpful(review.id);
    setHasMarked(true);
  };

  return (
    <motion.li layout variants={fadeInUp} initial="hidden" animate="visible" exit="exit" className="py-6 first:pt-0">
      <article className="flex items-start gap-4">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bg-muted">
          <User className="size-5 text-fg-muted" />
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
          <div className="flex items-center gap-2">
            <Rating value={review.rating} />
            <time dateTime={review.date} className="text-sm text-fg-muted">
              {review.date}
            </time>
          </div>
          <h3 className="text-base font-semibold">{review.title}</h3>
          <p className="text-fg-secondary">{review.comment}</p>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3"
            onClick={handleHelpful}
            disabled={hasMarked}
            aria-pressed={hasMarked}
          >
            <ThumbsUp aria-hidden="true" className={cn(hasMarked && "fill-current")} />
            Útil ({review.helpful})
          </Button>
        </div>
      </article>
    </motion.li>
  );
}

function ReviewForm({ productId, onClose }: { productId: string; onClose: () => void }) {
  const addReview = useReviewStore((state) => state.addReview);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const complete = rating > 0 && title.trim() && comment.trim() && name.trim();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!complete) return;
    addReview({
      productId,
      userId: `user-${Date.now()}`,
      userName: name.trim(),
      rating,
      title: title.trim(),
      comment: comment.trim(),
      verified: false,
    });
    onClose();
  };

  return (
    <form
      id="review-form"
      onSubmit={handleSubmit}
      aria-labelledby="review-form-title"
      className="space-y-4 rounded-2xl border border-border bg-surface p-6"
    >
      <h3 id="review-form-title" className="text-lg font-bold">
        Escribir una reseña
      </h3>
      <RatingInput label="Tu calificación" value={rating} onValueChange={setRating} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tu nombre" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field label="Título" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resume tu experiencia" />
        </Field>
      </div>
      <Field label="Tu reseña" required>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Cuéntanos más sobre tu experiencia con este producto…"
          rows={4}
        />
      </Field>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!complete}>
          Publicar reseña
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
