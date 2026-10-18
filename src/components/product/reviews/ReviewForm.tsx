"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { REVIEW_COMMENT_MAX, REVIEW_TITLE_MAX, reviewSchema, type ReviewInput } from "@/lib/validations/review";
import type { ReviewActionResult } from "@/lib/reviews/actions";
import type { Review } from "@/types";
import { Button, Field, Input, RatingInput, Textarea, showToast } from "@/components/ui";
import { FormAlert } from "@/components/auth/FormAlert";

const emptyValues: ReviewInput = { rating: 0, title: "", comment: "" };
/** Fields in on-screen order. react-hook-form would focus by registration order, where the Controller-driven rating comes last. */
const FIELD_ORDER = ["rating", "title", "comment"] as const satisfies readonly (keyof ReviewInput)[];

/**
 * The Server Actions the form calls (src/lib/reviews/actions.ts), passed in by
 * ProductReviews; stories pass stand-ins that answer like the server.
 */
export interface ReviewFormActions {
  create: (productId: string, input: ReviewInput) => Promise<ReviewActionResult>;
  update: (reviewId: string, input: ReviewInput) => Promise<ReviewActionResult>;
}

interface ReviewFormProps {
  productId: string;
  /** Who the review is published as (the account's name). */
  authorName: string;
  /** The user's existing review: the form edits it instead of creating one. */
  review?: Review | null;
  /** Saved on the server. */
  onSaved: () => void;
  /** Cancelled. */
  onDone: () => void;
  /** Called once the form is in the DOM (it loads on demand, so the parent waits for it to move focus). */
  onReady?: () => void;
  actions: ReviewFormActions;
}

/**
 * Review form (react-hook-form + zod, the same schema the Server Action
 * validates with). Validates on submit, then as each field is fixed; focus
 * moves to the first invalid field. Creates the signed-in user's review, or
 * edits it when `review` is given. Loaded on demand by ProductReviews, so zod
 * and react-hook-form only ship when someone writes a review.
 */
export function ReviewForm({ productId, authorName, review, onSaved, onDone, onReady, actions }: ReviewFormProps) {
  const editing = !!review;
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setFocus,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ReviewInput>({
    resolver: zodResolver(reviewSchema),
    defaultValues: review ? { rating: review.rating, title: review.title, comment: review.comment } : emptyValues,
    mode: "onTouched",
    shouldFocusError: false,
  });
  const commentLength = useWatch({ control, name: "comment" })?.length ?? 0;

  const announceReady = useEffectEvent(() => onReady?.());
  useEffect(() => announceReady(), []);

  /** Focuses `name` and centres its whole group (legend, stars, error) below the sticky header. */
  const focusField = (name: keyof ReviewInput) => {
    setFocus(name);
    // setFocus focuses in a timeout, so this one is queued right after it.
    setTimeout(() => {
      const focused = document.activeElement;
      const group = focused instanceof HTMLElement ? focused.closest("fieldset, [data-slot='field']") : null;
      group?.scrollIntoView?.({ block: "center" });
    });
  };

  const onSubmit = async (data: ReviewInput) => {
    setFormError(null);
    let result: ReviewActionResult;
    try {
      result = review ? await actions.update(review.id, data) : await actions.create(productId, data);
    } catch {
      result = { ok: false, error: "No pudimos guardar tu reseña. Revisa tu conexión e inténtalo de nuevo." };
    }
    if (!result.ok) {
      const fieldErrors = result.fieldErrors ?? {};
      for (const name of FIELD_ORDER) {
        const message = fieldErrors[name];
        if (message) setError(name, { message });
      }
      const first = FIELD_ORDER.find((name) => fieldErrors[name]);
      if (first) focusField(first);
      else setFormError(result.error);
      return;
    }
    showToast.success(editing ? "Guardamos los cambios de tu reseña." : "¡Gracias! Tu reseña fue publicada.");
    onSaved();
  };

  return (
    <form
      id="review-form"
      noValidate
      onSubmit={handleSubmit(onSubmit, (invalid) => {
        const first = FIELD_ORDER.find((name) => invalid[name]);
        if (first) focusField(first);
      })}
      aria-labelledby="review-form-title"
      className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-card"
    >
      <div className="space-y-1">
        <h3 id="review-form-title" className="text-title">
          {editing ? "Editar tu reseña" : "Escribir una reseña"}
        </h3>
        <p className="text-label font-normal text-fg-muted">
          Se publica como <span className="font-semibold text-fg-secondary">{authorName}</span>.
        </p>
      </div>
      {formError ? <FormAlert>{formError}</FormAlert> : null}
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
      <Field label="Título" required error={errors.title?.message}>
        <Input placeholder="Resume tu experiencia" maxLength={REVIEW_TITLE_MAX} {...register("title")} />
      </Field>
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
          {editing ? "Guardar cambios" : "Publicar reseña"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
