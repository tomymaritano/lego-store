"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { CheckCircle, MessageSquare, PenLine, ThumbsUp } from "lucide-react";
import { collapse, fadeInUp, transitions } from "@/lib/motion";
import { cn, pluralize } from "@/lib/utils";
import { REVIEW_COMMENT_MAX, REVIEW_TITLE_MAX, reviewSchema, type ReviewInput } from "@/lib/validations";
import { useReviewStore } from "@/stores/reviewStore";
import type { Review } from "@/types";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Rating,
  RatingInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  showToast,
} from "@/components/ui";

/** Where to move focus when the reviews tab is opened from a link (see ProductDetailsTabs). */
export interface ReviewsFocusRequest {
  target: "heading" | "form";
}

interface ProductReviewsProps {
  productId: string;
  /** Each new request moves focus once: to the heading, or opens the form and focuses its first field. */
  focusRequest?: ReviewsFocusRequest | null;
}

const reviewCount = (n: number) => pluralize(n, "reseña");

export const REVIEW_SORTS = [
  { value: "recent", label: "Más recientes" },
  { value: "helpful", label: "Más útiles" },
  { value: "highest", label: "Mejor valoradas" },
  { value: "lowest", label: "Peor valoradas" },
] as const;

export type ReviewSort = (typeof REVIEW_SORTS)[number]["value"];

const comparators: Record<ReviewSort, (a: Review, b: Review) => number> = {
  recent: (a, b) => b.date.localeCompare(a.date),
  helpful: (a, b) => b.helpful - a.helpful || b.date.localeCompare(a.date),
  highest: (a, b) => b.rating - a.rating || b.date.localeCompare(a.date),
  lowest: (a, b) => a.rating - b.rating || b.date.localeCompare(a.date),
};

/** A copy of `reviews` in the chosen order (ties: newest first). */
export function sortReviews(reviews: readonly Review[], sort: ReviewSort): Review[] {
  return [...reviews].sort(comparators[sort]);
}

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

/**
 * Reviews for one product: average and rating histogram, a sortable list
 * with "útil" votes, and a validated form to add one. Reviews still live in
 * the client-side reviewStore (mock) until the backend provides them.
 */
export function ProductReviews({ productId, focusRequest }: ProductReviewsProps) {
  const [showForm, setShowForm] = useState(false);
  const [sort, setSort] = useState<ReviewSort>("recent");
  const toggleRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formPanelRef = useRef<HTMLDivElement>(null);
  /** True while the form is opening for a "write a review" link; focus waits for the open animation. */
  const [focusFormWhenOpen, setFocusFormWhenOpen] = useState(false);
  const [handledRequest, setHandledRequest] = useState<ReviewsFocusRequest | null>(null);

  // A new "write a review" request opens the form (state adjusted during render, not in an effect).
  if (focusRequest && focusRequest !== handledRequest) {
    setHandledRequest(focusRequest);
    if (focusRequest.target === "form" && !showForm) {
      setFocusFormWhenOpen(true);
      setShowForm(true);
    }
  }
  const allReviews = useReviewStore((state) => state.reviews);
  const markHelpful = useReviewStore((state) => state.markHelpful);

  const reviews = useMemo(
    () => sortReviews(allReviews.filter((r) => r.productId === productId), sort),
    [allReviews, productId, sort]
  );

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }, [reviews]);

  const distribution = [5, 4, 3, 2, 1].map((rating) => {
    const count = reviews.filter((r) => r.rating === rating).length;
    return { rating, count, percentage: reviews.length > 0 ? (count / reviews.length) * 100 : 0 };
  });

  const focusFirstField = () => {
    const panel = formPanelRef.current;
    const radio =
      panel?.querySelector<HTMLInputElement>('input[type="radio"]:checked') ??
      panel?.querySelector<HTMLInputElement>('input[type="radio"]');
    if (!radio) return;
    radio.focus({ preventScroll: true });
    // Show the form from its top (legend and stars), below the sticky header (scroll-padding).
    panel?.querySelector("form")?.scrollIntoView?.({ block: "start" });
  };

  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.target === "heading") {
      // The link already scrolled to the tabs; the heading sits right below them.
      headingRef.current?.focus({ preventScroll: true });
    } else if (!focusFormWhenOpen) {
      // The form was already open: focus it now (otherwise its open animation does).
      focusFirstField();
    }
    // Only a new request moves focus, not later changes to the form state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  const closeForm = () => {
    setShowForm(false);
    toggleRef.current?.focus();
  };

  return (
    <section aria-labelledby="reviews-title" className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="reviews-title" ref={headingRef} tabIndex={-1} className="rounded-sm text-title outline-none">
            Reseñas de clientes
          </h2>
          {reviews.length > 0 && <p className="text-fg-muted">{reviewCount(reviews.length)}</p>}
        </div>
        <Button
          ref={toggleRef}
          variant={showForm ? "secondary" : "primary"}
          onClick={() => setShowForm((open) => !open)}
          aria-expanded={showForm}
          aria-controls="review-form-panel"
        >
          {showForm ? null : <PenLine aria-hidden="true" />}
          {showForm ? "Cancelar" : "Escribir reseña"}
        </Button>
      </div>

      <div id="review-form-panel" ref={formPanelRef}>
        <AnimatePresence initial={false}>
          {showForm && (
            <m.div
              key="review-form"
              variants={collapse}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="overflow-hidden"
              onAnimationComplete={(definition) => {
                if (definition !== "visible" || !focusFormWhenOpen) return;
                setFocusFormWhenOpen(false);
                focusFirstField();
              }}
            >
              <ReviewForm productId={productId} onDone={closeForm} />
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {reviews.length === 0 ? (
        <EmptyState
          icon={<MessageSquare />}
          headingLevel="h3"
          title="Aún no hay reseñas"
          description="¿Ya lo armaste? Cuéntales a otros fans qué te pareció."
          className="rounded-2xl border border-dashed border-border bg-bg-subtle"
        />
      ) : (
        <div className="space-y-8">
          <div className="grid gap-8 rounded-2xl border border-border bg-bg-subtle p-6 md:grid-cols-[auto_1fr] md:gap-12">
            <div className="flex flex-col items-center gap-2 md:items-start">
              <p className="text-5xl font-bold tabular-nums">
                {averageRating.toLocaleString("es-AR")}
                <span className="sr-only"> de 5</span>
              </p>
              <Rating value={averageRating} size="lg" />
              <p className="text-sm text-fg-muted">Basado en {reviewCount(reviews.length)}</p>
            </div>

            <ul className="space-y-2 self-center" aria-label="Distribución de valoraciones">
              {distribution.map(({ rating, count, percentage }) => (
                <li key={rating} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-sm text-fg-secondary">{pluralize(rating, "estrella")}</span>
                  <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-bg-muted">
                    <m.span
                      className="block h-full origin-left rounded-full bg-rating"
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: percentage / 100 }}
                      viewport={{ once: true }}
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
          <div className="space-y-4">
            {reviews.length > 1 && (
              <Field label="Ordenar reseñas" className="sm:w-64">
                <Select items={REVIEW_SORTS} value={sort} onValueChange={(value) => value && setSort(value as ReviewSort)}>
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REVIEW_SORTS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <LayoutGroup>
              <ul className="divide-y divide-border" aria-label="Reseñas">
                <AnimatePresence initial={false}>
                  {reviews.map((review) => (
                    <ReviewItem key={review.id} review={review} onMarkHelpful={markHelpful} />
                  ))}
                </AnimatePresence>
              </ul>
            </LayoutGroup>
          </div>
        </div>
      )}
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
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bg-muted text-sm font-bold text-fg-secondary"
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
            <time dateTime={review.date} className="text-sm text-fg-muted">
              {formatReviewDate(review.date)}
            </time>
          </div>
          <h3 className="text-base font-semibold">{review.title}</h3>
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

const defaultValues: ReviewInput = { rating: 0, name: "", title: "", comment: "" };
/** Fields in on-screen order. react-hook-form would focus by registration order, where the Controller-driven rating comes last. */
const FIELD_ORDER = ["rating", "name", "title", "comment"] as const satisfies readonly (keyof ReviewInput)[];

/**
 * New review form (react-hook-form + zod). Validates on submit, then as the
 * visitor fixes each field; focus moves to the first invalid field.
 */
function ReviewForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const addReview = useReviewStore((state) => state.addReview);
  const {
    register,
    control,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ReviewInput>({ resolver: zodResolver(reviewSchema), defaultValues, mode: "onTouched", shouldFocusError: false });
  const commentLength = useWatch({ control, name: "comment" })?.length ?? 0;

  const onSubmit = (data: ReviewInput) => {
    addReview({
      productId,
      userId: "guest",
      userName: data.name,
      rating: data.rating,
      title: data.title,
      comment: data.comment,
      verified: false,
    });
    showToast.success("¡Gracias! Tu reseña fue publicada.");
    onDone();
  };

  return (
    <form
      id="review-form"
      noValidate
      onSubmit={handleSubmit(onSubmit, (invalid) => {
        const first = FIELD_ORDER.find((name) => invalid[name]);
        if (!first) return;
        setFocus(first);
        // focus() only scrolls the control itself into view; bring its whole group (legend,
        // stars, error) to the middle of the viewport so the sticky header never covers it.
        // setFocus focuses in a timeout, so this one is queued right after it.
        setTimeout(() => {
          const focused = document.activeElement;
          const group = focused instanceof HTMLElement ? focused.closest("fieldset, [data-slot='field']") : null;
          group?.scrollIntoView?.({ block: "center" });
        });
      })}
      aria-labelledby="review-form-title"
      className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-card"
    >
      <h3 id="review-form-title" className="text-lg font-bold">
        Escribir una reseña
      </h3>
      <Controller
        control={control}
        name="rating"
        render={({ field, fieldState }) => (
          <RatingInput
            label="Tu calificación"
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            error={fieldState.error?.message}
            required
          />
        )}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Tu nombre" required error={errors.name?.message}>
          <Input autoComplete="name" {...register("name")} />
        </Field>
        <Field label="Título" required error={errors.title?.message}>
          <Input placeholder="Resume tu experiencia" maxLength={REVIEW_TITLE_MAX} {...register("title")} />
        </Field>
      </div>
      <Field
        label="Tu reseña"
        required
        error={errors.comment?.message}
        hint={`${commentLength} / ${REVIEW_COMMENT_MAX} caracteres`}
      >
        <Textarea
          placeholder="Cuéntanos más sobre tu experiencia con este producto…"
          rows={4}
          maxLength={REVIEW_COMMENT_MAX}
          {...register("comment")}
        />
      </Field>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={isSubmitting}>
          Publicar reseña
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
