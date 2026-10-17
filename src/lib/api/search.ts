/**
 * The one search algorithm of the store: every term of the query has to
 * appear (as a substring) somewhere in the product's name, theme, category
 * (slug and display name) or description. Case- and accent-insensitive, so
 * "vehiculos" finds "Vehículos" and "STAR wars" finds "Star Wars".
 *
 * The database does the matching: each product stores that text already
 * normalised (Product.searchText, built by productSearchColumns), and the
 * query's terms are normalised the same way, so a plain LIKE per term is
 * accent-insensitive without a Postgres extension. Results are ranked by how
 * many terms hit the name (Product.searchName), then catalogue order.
 *
 * Pure functions: lib/api, the seed and the admin writes all use them.
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

interface SearchableProduct {
  name: string;
  theme: string;
  /** Category slug. */
  categoryId: string;
  /** Category display name ("Vehículos" for "cars"). */
  categoryName: string;
  description: string;
}

/**
 * The derived search columns of a product. Recompute them on every write that
 * touches one of the inputs (create, admin edit, category rename).
 */
export function productSearchColumns(product: SearchableProduct): { searchText: string; searchName: string } {
  return {
    searchText: normalizeText(
      [product.name, product.theme, product.categoryId, product.categoryName, product.description].join(" ")
    ),
    searchName: normalizeText(product.name),
  };
}

/**
 * A term as a literal LIKE pattern: Prisma's `contains` does not escape the
 * LIKE wildcards, so "%" would otherwise match every product.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** How many of the (normalised) terms appear in a normalised name. */
export function nameHits(searchName: string, terms: string[]): number {
  return terms.filter((term) => searchName.includes(term)).length;
}
