/**
 * API Service Layer
 *
 * Centralized exports for all API services.
 * Import from here for clean imports throughout the app:
 *
 * @example
 * import { getProducts, getProductById, searchProducts } from "@/lib/api";
 */

// Product API
export {
  getProducts,
  getProductById,
  searchProducts,
  getProductsByCategory,
  getProductsByTheme,
  getFeaturedProducts,
  getSaleProducts,
  getPaginatedProducts,
  getRelatedProducts,
  getFilterOptions,
} from "./products";
