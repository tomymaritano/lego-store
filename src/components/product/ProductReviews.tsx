"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { MessageSquare, PenLine } from "lucide-react";
import { collapse } from "@/lib/motion";
import { pluralize } from "@/lib/utils";
import { productReviewList, useReviewStore } from "@/stores/reviewStore";
import type { Review } from "@/types";
import {
  Button,
  EmptyState,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@/components/ui";
import { ReviewItem } from "./reviews/ReviewItem";
import { ReviewSummary } from "./reviews/ReviewSummary";
import { REVIEW_SORTS, sortReviews, type ReviewSort } from "./reviews/sortReviews";

export { REVIEW_SORTS, sortReviews, type ReviewSort };

// The form (react-hook-form + zod) loads on demand: preloaded when the
// "Escribir reseña" button is hovered, focused or pressed.
const loadReviewForm = () => import("./reviews/ReviewForm");
const ReviewForm = dynamic(() => loadReviewForm().then((mod) => mod.ReviewForm), {
  ssr: false,
  loading: () => <Skeleton className="h-96 rounded-2xl" />,
});

/** Where to move focus when the reviews tab is opened from a link (see ProductDetailsTabs). */
export interface ReviewsFocusRequest {
  target: "heading" | "form";
}

interface ProductReviewsProps {
  productId: string;
  /** Published reviews (database), from the product page. */
  publishedReviews?: readonly Review[];
  /** Each new request moves focus once: to the heading, or opens the form and focuses its first field. */
  focusRequest?: ReviewsFocusRequest | null;
}

const reviewCount = (n: number) => pluralize(n, "reseña");

const NO_REVIEWS: readonly Review[] = [];

/**
 * Reviews for one product: summary (average + histogram), a sortable list
 * with "útil" votes, and a validated form to add one. Lists the published
 * reviews plus the ones this visitor wrote; the visitor's own reviews and
 * votes stay in the browser (reviewStore) until the reviews stage saves them.
 */
export function ProductReviews({ productId, publishedReviews = NO_REVIEWS, focusRequest }: ProductReviewsProps) {
  const [showForm, setShowForm] = useState(false);
  const [sort, setSort] = useState<ReviewSort>("recent");
  const toggleRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formPanelRef = useRef<HTMLDivElement>(null);
  /** True while the form is opening for a "write a review" link; focus waits for it to load and finish opening. */
  const [focusFormWhenOpen, setFocusFormWhenOpen] = useState(false);
  const formReady = useRef(false);
  const panelOpened = useRef(false);
  const [handledRequest, setHandledRequest] = useState<ReviewsFocusRequest | null>(null);

  // A new "write a review" request opens the form (state adjusted during render, not in an effect).
  if (focusRequest && focusRequest !== handledRequest) {
    setHandledRequest(focusRequest);
    if (focusRequest.target === "form" && !showForm) {
      setFocusFormWhenOpen(true);
      setShowForm(true);
    }
  }
  const ownReviews = useReviewStore((state) => state.reviews);
  const helpfulVotes = useReviewStore((state) => state.helpfulVotes);
  const markHelpful = useReviewStore((state) => state.markHelpful);

  const reviews = useMemo(
    () => sortReviews(productReviewList(publishedReviews, ownReviews, helpfulVotes, productId), sort),
    [publishedReviews, ownReviews, helpfulVotes, productId, sort]
  );

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

  /** Focuses the form once it has both loaded and finished opening (whichever comes last). */
  const focusFormIfPending = () => {
    if (!focusFormWhenOpen || !formReady.current || !panelOpened.current) return;
    setFocusFormWhenOpen(false);
    focusFirstField();
  };

  const onFocusRequest = useEffectEvent((request: ReviewsFocusRequest) => {
    if (request.target === "heading") {
      // The link already scrolled to the tabs; the heading sits right below them.
      headingRef.current?.focus({ preventScroll: true });
    } else if (!focusFormWhenOpen) {
      // The form was already open: focus it now (otherwise opening it does).
      focusFirstField();
    }
  });

  // Only a new request moves focus, not later changes to the form state.
  useEffect(() => {
    if (focusRequest) onFocusRequest(focusRequest);
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
          onPointerEnter={() => void loadReviewForm()}
          onFocus={() => void loadReviewForm()}
          onPointerDown={() => void loadReviewForm()}
          aria-expanded={showForm}
          aria-controls="review-form-panel"
        >
          {showForm ? null : <PenLine aria-hidden="true" />}
          {showForm ? "Cancelar" : "Escribir reseña"}
        </Button>
      </div>

      <div id="review-form-panel" ref={formPanelRef}>
        <AnimatePresence
          initial={false}
          onExitComplete={() => {
            formReady.current = false;
            panelOpened.current = false;
          }}
        >
          {showForm && (
            <m.div
              key="review-form"
              variants={collapse}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="overflow-hidden"
              onAnimationComplete={(definition) => {
                if (definition !== "visible") return;
                panelOpened.current = true;
                focusFormIfPending();
              }}
            >
              <ReviewForm
                productId={productId}
                onDone={closeForm}
                onReady={() => {
                  formReady.current = true;
                  focusFormIfPending();
                }}
              />
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
          <ReviewSummary reviews={reviews} />
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
