import { products } from "@/data/products";
import { categories } from "@/data/categories";
import type { Product } from "@/types";

/**
 * The seed catalogue as plain Products, for unit tests that need realistic
 * fixtures without a database (lib/api itself is covered by the integration
 * tests in __tests__/integration, against the test database).
 */
export const fixtureProducts: Product[] = products.map((p) => ({ ...p, reviewCount: 3 }));

export const fixtureProduct = (id: string): Product => {
  const product = fixtureProducts.find((p) => p.id === id);
  if (!product) throw new Error(`No fixture product ${id}`);
  return product;
};

export const fixtureCategoryIds = new Set(categories.map((c) => c.id));
