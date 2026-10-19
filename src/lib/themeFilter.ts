import { normalizeText } from "@/lib/api/search";
import type { FilterOption, ProductQuery } from "@/types";

/**
 * The filter's theme options are keyed by slug ("star-wars"), but older or
 * bookmarked links name the theme ("?theme=Star%20Wars"), which the server
 * still filters by (matchThemes). Rewrites those names to their option's
 * slug so the checkbox and the chip show the filter as on, and unchecking it
 * removes it. Values that match no option (a hidden theme, a typo) stay as
 * they are. Returns the same query object when nothing changes.
 */
export function canonicalizeThemes(query: ProductQuery, themes: readonly FilterOption[]): ProductQuery {
  if (!query.themes?.length) return query;
  const bySlugOrName = new Map<string, string>();
  for (const option of themes) {
    bySlugOrName.set(option.value, option.value);
    bySlugOrName.set(normalizeText(option.label), option.value);
  }
  const next = Array.from(
    new Set(query.themes.map((value) => bySlugOrName.get(value) ?? bySlugOrName.get(normalizeText(value)) ?? value))
  );
  const changed = next.length !== query.themes.length || next.some((value, index) => value !== query.themes![index]);
  return changed ? { ...query, themes: next } : query;
}
