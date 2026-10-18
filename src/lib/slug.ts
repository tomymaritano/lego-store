import { normalizeText } from "@/lib/api/search";

/** Longest slug the admin forms accept (URLs and filter values). */
export const MAX_SLUG = 60;

/** What a slug may look like: lowercase letters, digits and single hyphens inside. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * "Star Wars: Episodio I" -> "star-wars-episodio-i": lowercase, no accents,
 * anything else as one "-". The themes migration computes the same in SQL.
 * Client-safe.
 */
export function slugify(text: string): string {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/, "");
}
