"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { MessageSquare, PenLine } from "lucide-react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { collapse } from "@/lib/motion";
import { pluralize } from "@/lib/utils";
import { fetchReviewPage, fetchViewerReviews } from "@/lib/api-client";
import { loginHref } from "@/lib/auth/callback-url";
import { createReviewAction, deleteReviewAction, setHelpfulAction, updateReviewAction } from "@/lib/reviews/actions";
import { DEFAULT_REVIEW_SORT, REVIEW_SORTS, type ReviewSort } from "@/lib/reviews/sorts";
import { useViewer } from "@/providers/ViewerProvider";
import type { Review, ReviewPage, ViewerReviews } from "@/types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  showToast,
} from "@/components/ui";
import { WRITE_REVIEW_HASH } from "./anchors";
import { ReviewItem } from "./reviews/ReviewItem";
import { ReviewSummary } from "./reviews/ReviewSummary";

export { REVIEW_SORTS, type ReviewSort };

// The form (react-hook-form + zod) loads on demand: preloaded when the
// "Escribir reseña" button is hovered, focused or pressed.
const loadReviewForm = () => import("./reviews/ReviewForm");
const ReviewForm = dynamic(() => loadReviewForm().then((mod) => mod.ReviewForm), {
  ssr: false,
  loading: () => <Skeleton className="h-96 rounded-2xl" />,
});

const formActions = { create: createReviewAction, update: updateReviewAction };

/** Where to move focus when the reviews tab is opened from a link (see ProductDetailsTabs). */
export interface ReviewsFocusRequest {
  target: "heading" | "form";
}

interface ProductReviewsProps {
  productId: string;
  /** First page of the reviews, newest first, with the summary (server-rendered from the database). */
  initialPage: ReviewPage;
  /** Each new request moves focus once: to the heading, or opens the form and focuses its first field. */
  focusRequest?: ReviewsFocusRequest | null;
}

const reviewCount = (n: number) => pluralize(n, "reseña");

const NO_VIEWER_REVIEWS: ViewerReviews = { review: null, helpful: [] };

/** React Query keys: every key of a product's reviews starts with reviewsKey(productId). */
export const reviewsKey = (productId: string) => ["reviews", productId] as const;

/**
 * Reviews for one product: summary (average + histogram over all reviews), a
 * list sorted and paged on the server ("Ver más reseñas"), and the signed-in
 * user's side: write or edit their review, delete it, and mark others' as
 * "útil" (a toggle). Visitors are sent to log in to write one.
 *
 * Writes are Server Actions that refresh the product's cache: the page itself
 * re-renders with the new rating and count, and the lists here are refetched.
 */
export function ProductReviews({ productId, initialPage, focusRequest }: ProductReviewsProps) {
  const viewer = useViewer();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [sort, setSort] = useState<ReviewSort>(DEFAULT_REVIEW_SORT);
  const [deleting, setDeleting] = useState<Review | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  /** "Útil" votes sent but not answered yet (optimistic), by review id. */
  const [pendingVotes, setPendingVotes] = useState<ReadonlyMap<string, boolean>>(new Map());
  const toggleRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
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
    if (focusRequest.target === "form" && !showForm && viewer) {
      setFocusFormWhenOpen(true);
      setShowForm(true);
    }
  }

  // Server-rendered first page as initial data, so the list shows without a request; it is
  // fresh for a minute (every review write refetches it explicitly).
  const [mountedAt] = useState(() => Date.now());
  const list = useInfiniteQuery({
    queryKey: [...reviewsKey(productId), "list", sort],
    queryFn: ({ pageParam, signal }) => fetchReviewPage(productId, sort, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    initialData: sort === DEFAULT_REVIEW_SORT ? { pages: [initialPage], pageParams: [1] } : undefined,
    initialDataUpdatedAt: mountedAt,
    staleTime: 60_000,
  });

  const mine = useQuery({
    queryKey: [...reviewsKey(productId), "mine", viewer?.id ?? null],
    queryFn: ({ signal }) => fetchViewerReviews(productId, signal),
    enabled: !!viewer,
  });
  const viewerReviews = (viewer && mine.data) || NO_VIEWER_REVIEWS;
  const ownReview = viewerReviews.review;

  const pages = list.data?.pages ?? [];
  const summary = pages[0]?.summary ?? initialPage.summary;
  const total = summary.count;
  const reviews = pages.flatMap((page) => page.items);
  const votedIds = new Set(viewerReviews.helpful);

  /** Refetches everything this product's reviews show (after a write). */
  const refresh = () => queryClient.invalidateQueries({ queryKey: reviewsKey(productId) });

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
    if (request.target === "heading" || !viewer) {
      // The link already scrolled to the tabs; the heading sits right below them. Visitors
      // asked to write one land on the "Escribir reseña" link to log in.
      (request.target === "form" ? toggleRef.current : headingRef.current)?.focus({ preventScroll: true });
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

  const onSaved = () => {
    void refresh();
    closeForm();
  };

  const changeHelpful = async (review: Review, helpful: boolean) => {
    if (!viewer) {
      showToast.info("Inicia sesión para marcar reseñas como útiles.");
      return;
    }
    setPendingVotes((votes) => new Map(votes).set(review.id, helpful));
    const result = await setHelpfulAction(review.id, helpful).catch(() => null);
    if (result?.ok) await refresh();
    else showToast.error(result?.error ?? "No pudimos guardar tu voto. Inténtalo de nuevo.");
    setPendingVotes((votes) => {
      const next = new Map(votes);
      next.delete(review.id);
      return next;
    });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletePending(true);
    const result = await deleteReviewAction(deleting.id).catch(() => null);
    setDeletePending(false);
    if (!result?.ok) {
      showToast.error(result?.error ?? "No pudimos eliminar tu reseña. Inténtalo de nuevo.");
      return;
    }
    setDeleting(null);
    setShowForm(false);
    showToast.success("Eliminamos tu reseña.");
    await refresh();
    headingRef.current?.focus();
  };

  /** A review as shown: the pending vote counted in. */
  const shown = (review: Review): { review: Review; voted: boolean } => {
    const saved = votedIds.has(review.id);
    const voted = pendingVotes.get(review.id) ?? saved;
    return { review: voted === saved ? review : { ...review, helpful: review.helpful + (voted ? 1 : -1) }, voted };
  };

  const writeLabel = ownReview ? "Editar tu reseña" : "Escribir reseña";

  return (
    <section aria-labelledby="reviews-title" className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="reviews-title" ref={headingRef} tabIndex={-1} className="rounded-sm text-title outline-none">
            Reseñas de clientes
          </h2>
          {total > 0 && <p className="text-fg-muted">{reviewCount(total)}</p>}
        </div>
        {viewer ? (
          <Button
            ref={toggleRef}
            variant={showForm ? "secondary" : "primary"}
            onClick={() => setShowForm((open) => !open)}
            onPointerEnter={() => void loadReviewForm()}
            onFocus={() => void loadReviewForm()}
            onPointerDown={() => void loadReviewForm()}
            aria-expanded={showForm}
            aria-controls="review-form-panel"
            disabled={mine.isPending}
            focusableWhenDisabled
          >
            {showForm ? null : <PenLine aria-hidden="true" />}
            {showForm ? "Cancelar" : writeLabel}
          </Button>
        ) : (
          <div className="flex flex-col gap-1 sm:items-end">
            <Button
              ref={toggleRef}
              render={<Link href={loginHref(`/item/${productId}#${WRITE_REVIEW_HASH}`)} />}
            >
              <PenLine aria-hidden="true" />
              Escribir reseña
            </Button>
            <p className="text-caption text-fg-muted">Inicia sesión para opinar</p>
          </div>
        )}
      </div>

      <div id="review-form-panel" ref={formPanelRef}>
        <AnimatePresence
          initial={false}
          onExitComplete={() => {
            formReady.current = false;
            panelOpened.current = false;
          }}
        >
          {showForm && viewer && !mine.isPending && (
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
                authorName={viewer.name?.trim() || "Cliente"}
                review={ownReview}
                actions={formActions}
                onSaved={onSaved}
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

      {total === 0 ? (
        <EmptyState
          icon={<MessageSquare />}
          headingLevel="h3"
          title="Aún no hay reseñas"
          description="¿Ya lo armaste? Cuéntales a otros fans qué te pareció."
          className="rounded-2xl border border-dashed border-border bg-bg-subtle"
        />
      ) : (
        <div className="space-y-8">
          <ReviewSummary summary={summary} />
          <div className="space-y-4">
            {total > 1 && (
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
            {list.isPending ? (
              <div aria-busy="true" className="space-y-4">
                <span className="sr-only">Cargando reseñas…</span>
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
              </div>
            ) : (
              <LayoutGroup>
                <ul className="divide-y divide-border" aria-label="Reseñas" aria-busy={list.isFetching}>
                  <AnimatePresence initial={false}>
                    {reviews.map((item) => {
                      const { review, voted } = shown(item);
                      const isMine = !!viewer && review.userId === viewer.id;
                      return (
                        <ReviewItem
                          key={review.id}
                          review={review}
                          voted={voted}
                          mine={isMine}
                          voteDisabled={!!viewer && mine.isPending}
                          onHelpfulChange={changeHelpful}
                          onEdit={() => {
                            void loadReviewForm();
                            setFocusFormWhenOpen(true);
                            setShowForm(true);
                            if (showForm) focusFirstField();
                          }}
                          onDelete={() => setDeleting(review)}
                        />
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </LayoutGroup>
            )}
            {list.isError ? (
              <p role="alert" className="text-label font-normal text-danger">
                No pudimos cargar las reseñas. Inténtalo de nuevo.
              </p>
            ) : null}
            {list.hasNextPage ? (
              <div className="flex justify-center">
                <Button variant="secondary" onClick={() => void list.fetchNextPage()} loading={list.isFetchingNextPage}>
                  Ver más reseñas
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <Dialog open={!!deleting} onOpenChange={(open) => !open && !deletePending && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar tu reseña?</DialogTitle>
            <DialogDescription>Se quita de la página del producto y no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={deletePending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} loading={deletePending}>
              Eliminar reseña
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
