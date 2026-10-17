"use client";

import { useEffect, useEffectEvent } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { REVIEW_COMMENT_MAX, REVIEW_TITLE_MAX, reviewSchema, type ReviewInput } from "@/lib/validations/review";
import { useReviewStore } from "@/stores/reviewStore";
import { Button, Field, Input, RatingInput, Textarea, showToast } from "@/components/ui";

const defaultValues: ReviewInput = { rating: 0, name: "", title: "", comment: "" };
/** Fields in on-screen order. react-hook-form would focus by registration order, where the Controller-driven rating comes last. */
const FIELD_ORDER = ["rating", "name", "title", "comment"] as const satisfies readonly (keyof ReviewInput)[];

interface ReviewFormProps {
  productId: string;
  onDone: () => void;
  /** Called once the form is in the DOM (it loads on demand, so the parent waits for it to move focus). */
  onReady?: () => void;
}

/**
 * New review form (react-hook-form + zod). Validates on submit, then as the
 * visitor fixes each field; focus moves to the first invalid field.
 * Loaded on demand by ProductReviews, so zod and react-hook-form only ship
 * when someone writes a review.
 */
export function ReviewForm({ productId, onDone, onReady }: ReviewFormProps) {
  const addReview = useReviewStore((state) => state.addReview);
  const {
    register,
    control,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ReviewInput>({ resolver: zodResolver(reviewSchema), defaultValues, mode: "onTouched", shouldFocusError: false });
  const commentLength = useWatch({ control, name: "comment" })?.length ?? 0;

  const announceReady = useEffectEvent(() => onReady?.());
  useEffect(() => announceReady(), []);

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
