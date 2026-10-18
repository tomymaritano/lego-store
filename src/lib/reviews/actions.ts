"use server";

import { updateCatalog } from "@/lib/api/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { rateLimits, waitMessage } from "@/lib/rate-limit";
import { reviewIdSchema, reviewSchema, type ReviewField } from "@/lib/validations/review";
import { createReview, deleteReview, setHelpful, updateReview, type ReviewWriteResult } from "./mutations";

/*
 * Review Server Actions (product page). Each one checks the session itself,
 * validates its input with the same zod schema as the form, and writes
 * through ./mutations.ts (one transaction with the product's cached rating).
 *
 * Afterwards updateCatalog() expires the product's cache tags with updateTag:
 * Next re-renders the product page in this same response, so the rating, the
 * review count and the list show the change at once, and every other visitor
 * gets fresh data on their next request.
 */

export type ReviewActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Partial<Record<ReviewField, string>> };

export type HelpfulActionResult = { ok: true; voted: boolean; helpful: number } | { ok: false; error: string };

const SIGN_IN = "Inicia sesión para opinar sobre los productos.";
const INVALID = "Revisa los datos de tu reseña.";
const NOT_FOUND = "No encontramos esa reseña. Puede que se haya eliminado.";

function parseContent(input: unknown) {
  const parsed = reviewSchema.safeParse(input);
  if (parsed.success) return { ok: true as const, data: parsed.data };
  const fieldErrors: Partial<Record<ReviewField, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as ReviewField | undefined;
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return { ok: false as const, result: { ok: false as const, error: INVALID, fieldErrors } };
}

function written(result: ReviewWriteResult, messages: { not_found: string; duplicate?: string }): ReviewActionResult {
  if (!result.ok) {
    return { ok: false, error: result.reason === "duplicate" ? (messages.duplicate ?? INVALID) : messages.not_found };
  }
  // The rating moved: the product page and every listing that shows or sorts by it.
  updateCatalog({ productIds: [result.productId] });
  return { ok: true };
}

/** Publishes the signed-in user's review of a product (one per product; rate limited). */
export async function createReviewAction(productId: unknown, input: unknown): Promise<ReviewActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGN_IN };
  const id = reviewIdSchema.safeParse(productId);
  if (!id.success) return { ok: false, error: "Ese producto ya no está en el catálogo." };
  const content = parseContent(input);
  if (!content.ok) return content.result;

  const limit = await rateLimits.reviewCreate.consume(user.id);
  if (!limit.ok) {
    return { ok: false, error: `Publicaste muchas reseñas seguidas. Vuelve a intentarlo en ${waitMessage(limit.retryAfterSeconds)}.` };
  }
  const result = await createReview(getDb(), user.id, id.data, content.data);
  return written(result, {
    not_found: "Ese producto ya no está en el catálogo.",
    duplicate: "Ya publicaste una reseña de este producto. Puedes editarla.",
  });
}

/** Edits the signed-in user's own review. */
export async function updateReviewAction(reviewId: unknown, input: unknown): Promise<ReviewActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGN_IN };
  const id = reviewIdSchema.safeParse(reviewId);
  if (!id.success) return { ok: false, error: NOT_FOUND };
  const content = parseContent(input);
  if (!content.ok) return content.result;
  return written(await updateReview(getDb(), user.id, id.data, content.data), { not_found: NOT_FOUND });
}

/** Deletes the signed-in user's own review (an admin can delete any). */
export async function deleteReviewAction(reviewId: unknown): Promise<ReviewActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGN_IN };
  const id = reviewIdSchema.safeParse(reviewId);
  if (!id.success) return { ok: false, error: NOT_FOUND };
  return written(await deleteReview(getDb(), { id: user.id, role: user.role }, id.data), { not_found: NOT_FOUND });
}

/** Marks or unmarks a review as "útil" for the signed-in user. */
export async function setHelpfulAction(reviewId: unknown, helpful: unknown): Promise<HelpfulActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Inicia sesión para marcar reseñas como útiles." };
  const id = reviewIdSchema.safeParse(reviewId);
  if (!id.success || typeof helpful !== "boolean") return { ok: false, error: NOT_FOUND };

  const limit = await rateLimits.reviewHelpful.consume(user.id);
  if (!limit.ok) return { ok: false, error: `Demasiados votos seguidos. Vuelve a intentarlo en ${waitMessage(limit.retryAfterSeconds)}.` };

  const result = await setHelpful(getDb(), user.id, id.data, helpful);
  if (!result.ok) {
    return { ok: false, error: result.reason === "own_review" ? "No puedes marcar tu propia reseña como útil." : NOT_FOUND };
  }
  // Only this product's reviews changed (no rating moved): leave the shared listings cached.
  updateCatalog({ productIds: [result.productId], listings: false });
  return { ok: true, voted: result.voted, helpful: result.helpful };
}
