import { z } from "zod";

export const REVIEW_TITLE_MAX = 80;
const REVIEW_COMMENT_MIN = 10;
export const REVIEW_COMMENT_MAX = 1000;

/**
 * A review's content, in the product page form and in the review Server
 * Actions (the same schema validates both). `rating` is 0 in the form until
 * a star is picked. The author's name comes from the account, not the form.
 */
export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Elige una calificación de 1 a 5 estrellas").max(5, "Elige una calificación de 1 a 5 estrellas"),
  title: z
    .string()
    .trim()
    .min(3, "Escribe un título (al menos 3 caracteres)")
    .max(REVIEW_TITLE_MAX, `El título no puede superar ${REVIEW_TITLE_MAX} caracteres`),
  comment: z
    .string()
    .trim()
    .min(REVIEW_COMMENT_MIN, `Cuéntanos un poco más (al menos ${REVIEW_COMMENT_MIN} caracteres)`)
    .max(REVIEW_COMMENT_MAX, `La reseña no puede superar ${REVIEW_COMMENT_MAX} caracteres`),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

export type ReviewField = keyof ReviewInput;

/** Ids from the client (review, product): non-empty, short strings. */
export const reviewIdSchema = z.string().trim().min(1).max(64);
