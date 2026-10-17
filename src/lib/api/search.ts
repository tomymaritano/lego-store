import type { Product } from "@/types";

/**
 * The one search algorithm of the store: every term of the query has to
 * appear (as a substring) somewhere in the product's name, theme, category
 * (slug and display name) or description. Case- and accent-insensitive, so
 * "vehiculos" finds "Vehículos" and "STAR wars" finds "Star Wars".
 *
 * Results are ranked by how many terms hit the name, then catalogue order.
 */

/** Lowercase, strip diacritics, collapse whitespace. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(query: string): string[] {
  const normalized = normalizeText(query);
  return normalized ? Array.from(new Set(normalized.split(" "))) : [];
}

function haystack(product: Product, categoryName?: string): string {
  return normalizeText(
    [product.name, product.theme, product.category, categoryName ?? "", product.description].join(" ")
  );
}

/**
 * Filters and ranks `products` for `query`. An empty query returns [] (there is
 * nothing to search for); callers that want "everything" skip the search.
 */
export function search(
  products: Product[],
  query: string,
  categoryName: (slug: string) => string | undefined = () => undefined
): Product[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  return products
    .map((product, index) => {
      const text = haystack(product, categoryName(product.category));
      if (!terms.every((term) => text.includes(term))) return null;
      const name = normalizeText(product.name);
      const score = terms.filter((term) => name.includes(term)).length;
      return { product, index, score };
    })
    .filter((hit): hit is { product: Product; index: number; score: number } => hit !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((hit) => hit.product);
}
