import type { Product } from "@/types";

/** Rows of the compare table, in display order. */
export const COMPARE_ROWS = [
  { key: "price", label: "Precio" },
  { key: "category", label: "Categoría" },
  { key: "theme", label: "Tema" },
  { key: "pieces", label: "Piezas" },
  { key: "age", label: "Edad" },
  { key: "rating", label: "Calificación" },
  { key: "availability", label: "Disponibilidad" },
] as const;

export type CompareRowKey = (typeof COMPARE_ROWS)[number]["key"];

/**
 * The value a row compares (what "different" means for it). It must match
 * what the cell shows: availability shows the stock count, so it compares it.
 */
export function compareValue(product: Product, key: CompareRowKey): string | number {
  switch (key) {
    case "price":
      return product.price;
    case "rating":
      return product.rating;
    case "availability":
      return Math.max(0, product.stock);
    default:
      return product[key];
  }
}

/** Keys of the rows whose values are not all the same (needs two or more products). */
export function differingRows(products: Product[]): Set<CompareRowKey> {
  const keys = new Set<CompareRowKey>();
  if (products.length < 2) return keys;
  for (const { key } of COMPARE_ROWS) {
    const values = new Set(products.map((product) => compareValue(product, key)));
    if (values.size > 1) keys.add(key);
  }
  return keys;
}
