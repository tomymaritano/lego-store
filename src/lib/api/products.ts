/**
 * Products API Service
 *
 * This module provides an abstraction layer for product data operations.
 * Currently uses local data, but can be easily swapped to a real API.
 *
 * To connect to a real backend:
 * 1. Replace the imports with fetch/axios calls
 * 2. Update the functions to call your API endpoints
 * 3. Keep the same function signatures for compatibility
 */

import { products as localProducts } from "@/data/products";
import type {
  Product,
  ProductFilters,
  SortOption,
  PaginatedResponse,
} from "@/types";

// Configuration - change this to your API base URL when connecting to a backend
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Get all products
 */
export async function getProducts(): Promise<Product[]> {
  // TODO: Replace with API call when backend is available
  // return fetch(`${API_BASE_URL}/products`).then(res => res.json());
  return Promise.resolve(localProducts);
}

/**
 * Get a single product by ID
 */
export async function getProductById(id: string): Promise<Product | null> {
  // TODO: Replace with API call
  // return fetch(`${API_BASE_URL}/products/${id}`).then(res => res.json());
  const product = localProducts.find((p) => p.id === id);
  return Promise.resolve(product || null);
}

/**
 * Search products by query string
 */
export async function searchProducts(query: string): Promise<Product[]> {
  // TODO: Replace with API call
  // return fetch(`${API_BASE_URL}/products/search?q=${encodeURIComponent(query)}`).then(res => res.json());

  if (!query || query.length < 2) {
    return Promise.resolve([]);
  }

  const searchTerms = query.toLowerCase().split(" ");
  const results = localProducts.filter((product) => {
    const searchableText =
      `${product.name} ${product.theme} ${product.category} ${product.description}`.toLowerCase();
    return searchTerms.every((term) => searchableText.includes(term));
  });

  return Promise.resolve(results);
}

/**
 * Get products by category
 */
export async function getProductsByCategory(
  category: string
): Promise<Product[]> {
  // TODO: Replace with API call
  // return fetch(`${API_BASE_URL}/products?category=${category}`).then(res => res.json());
  const results = localProducts.filter(
    (p) => p.category.toLowerCase() === category.toLowerCase()
  );
  return Promise.resolve(results);
}

/**
 * Get products by theme
 */
export async function getProductsByTheme(theme: string): Promise<Product[]> {
  // TODO: Replace with API call
  // return fetch(`${API_BASE_URL}/products?theme=${theme}`).then(res => res.json());
  const results = localProducts.filter(
    (p) => p.theme.toLowerCase() === theme.toLowerCase()
  );
  return Promise.resolve(results);
}

/**
 * Get featured/new products
 */
export async function getFeaturedProducts(limit: number = 8): Promise<Product[]> {
  // TODO: Replace with API call
  // return fetch(`${API_BASE_URL}/products/featured?limit=${limit}`).then(res => res.json());
  const featured = localProducts.filter((p) => p.isNew).slice(0, limit);
  return Promise.resolve(featured);
}

/**
 * Get products on sale
 */
export async function getSaleProducts(limit?: number): Promise<Product[]> {
  // TODO: Replace with API call
  // return fetch(`${API_BASE_URL}/products/sale`).then(res => res.json());
  const onSale = localProducts.filter((p) => p.isOnSale);
  return Promise.resolve(limit ? onSale.slice(0, limit) : onSale);
}

/**
 * Get paginated products with filters and sorting
 */
export async function getPaginatedProducts(params: {
  page: number;
  limit: number;
  category?: string;
  theme?: string;
  filters?: Partial<ProductFilters>;
  sort?: SortOption;
  search?: string;
}): Promise<PaginatedResponse<Product>> {
  // TODO: Replace with API call
  // const queryParams = new URLSearchParams({...params});
  // return fetch(`${API_BASE_URL}/products?${queryParams}`).then(res => res.json());

  let filtered = [...localProducts];

  // Apply category filter
  if (params.category) {
    filtered = filtered.filter(
      (p) => p.category.toLowerCase() === params.category!.toLowerCase()
    );
  }

  // Apply theme filter
  if (params.theme) {
    filtered = filtered.filter(
      (p) => p.theme.toLowerCase() === params.theme!.toLowerCase()
    );
  }

  // Apply search
  if (params.search && params.search.length >= 2) {
    const searchTerms = params.search.toLowerCase().split(" ");
    filtered = filtered.filter((product) => {
      const searchableText =
        `${product.name} ${product.theme} ${product.category}`.toLowerCase();
      return searchTerms.every((term) => searchableText.includes(term));
    });
  }

  // Apply additional filters
  if (params.filters) {
    const { type, age, interests, pieces, highlight } = params.filters;

    if (type?.length) {
      filtered = filtered.filter((p) => type.includes(p.type));
    }
    if (age?.length) {
      filtered = filtered.filter((p) => age.includes(p.age));
    }
    if (interests?.length) {
      filtered = filtered.filter((p) =>
        p.interests.some((i) => interests.includes(i))
      );
    }
    if (pieces?.length) {
      filtered = filtered.filter((p) => pieces.includes(p.pieces));
    }
    if (highlight?.length) {
      filtered = filtered.filter((p) => highlight.includes(p.highlight));
    }
  }

  // Apply sorting
  if (params.sort) {
    switch (params.sort) {
      case "price_low_high":
        filtered.sort((a, b) => a.price - b.price);
        break;
      case "price_high_low":
        filtered.sort((a, b) => b.price - a.price);
        break;
      case "name_asc":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name_desc":
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "recommended":
      default:
        // Keep original order or sort by rating
        filtered.sort((a, b) => b.rating - a.rating);
        break;
    }
  }

  // Apply pagination
  const total = filtered.length;
  const start = (params.page - 1) * params.limit;
  const paginatedProducts = filtered.slice(start, start + params.limit);

  return Promise.resolve({
    products: paginatedProducts,
    total,
  });
}

/**
 * Get related products (same theme or category)
 */
export async function getRelatedProducts(
  productId: string,
  limit: number = 4
): Promise<Product[]> {
  // TODO: Replace with API call
  // return fetch(`${API_BASE_URL}/products/${productId}/related?limit=${limit}`).then(res => res.json());

  const product = localProducts.find((p) => p.id === productId);
  if (!product) return Promise.resolve([]);

  const related = localProducts
    .filter(
      (p) =>
        p.id !== productId &&
        (p.theme === product.theme || p.category === product.category)
    )
    .slice(0, limit);

  return Promise.resolve(related);
}

/**
 * Get unique values for filter options
 */
export async function getFilterOptions(): Promise<{
  categories: string[];
  themes: string[];
  types: string[];
  ages: string[];
}> {
  // TODO: Replace with API call
  // return fetch(`${API_BASE_URL}/products/filters`).then(res => res.json());

  const categories = Array.from(new Set(localProducts.map((p) => p.category)));
  const themes = Array.from(new Set(localProducts.map((p) => p.theme)));
  const types = Array.from(new Set(localProducts.map((p) => p.type)));
  const ages = Array.from(new Set(localProducts.map((p) => p.age)));

  return Promise.resolve({ categories, themes, types, ages });
}
