import { z } from "zod";
import { isAllowedImageUrl } from "@/lib/images";
import { MAX_SLUG, SLUG_PATTERN } from "@/lib/slug";
import { IMAGE_RULE, MAX_IMAGE_ALT } from "./admin";

/*
 * The admin's category and theme forms (/admin/categories, /admin/themes).
 * As every admin input, validated again on the server whatever the form did.
 */

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Completa ${label}`)
    .max(max, `Como máximo ${max} caracteres`);

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Completa el slug")
  .max(MAX_SLUG, `Como máximo ${MAX_SLUG} caracteres`)
  .regex(SLUG_PATTERN, "Solo minúsculas sin acentos, números y guiones entre palabras (por ejemplo: star-wars)");

export const categoryFormSchema = z.object({
  slug,
  name: text("el nombre", 60),
  description: text("la descripción", 200),
  image: z.string().trim().min(1, "Sube una imagen o pega su URL").refine(isAllowedImageUrl, IMAGE_RULE),
  imageAlt: text("el texto alternativo", MAX_IMAGE_ALT),
  visible: z.boolean(),
});

export type CategoryInput = z.output<typeof categoryFormSchema>;
export type CategoryField = keyof z.input<typeof categoryFormSchema>;

export const themeFormSchema = z.object({
  name: text("el nombre", 60),
  slug,
  visible: z.boolean(),
});

export type ThemeInput = z.output<typeof themeFormSchema>;
export type ThemeField = keyof z.input<typeof themeFormSchema>;

/** "Subir" / "Bajar" in the lists. */
export const moveSchema = z.object({ id: z.string().trim().min(1).max(64), direction: z.enum(["up", "down"]) });
