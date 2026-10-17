import { z } from "zod";

export const REVIEW_TITLE_MAX = 80;
const REVIEW_COMMENT_MIN = 10;
export const REVIEW_COMMENT_MAX = 1000;

/** Product page review form. `rating` is 0 until the visitor picks a star. */
export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Elige una calificación de 1 a 5 estrellas").max(5, "Elige una calificación de 1 a 5 estrellas"),
  name: z.string().trim().min(2, "Ingresa tu nombre (al menos 2 caracteres)").max(50, "El nombre no puede superar 50 caracteres"),
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
