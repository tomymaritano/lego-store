/**
 * The single data gateway of the app (server-only). Pages (Server Components)
 * and Route Handlers read the catalogue through these functions; nothing else
 * imports @/data (ESLint enforces it). Client islands call the Route Handlers
 * in src/app/api through @/lib/api-client.
 */
import "server-only";

export {
  getProducts,
  getProductById,
  getProductsByIds,
  searchProducts,
  getSearchSuggestions,
  getPaginatedProducts,
  getRelatedProducts,
  getFilterOptions,
  getFacetCounts,
  getFeaturedProducts,
  getSaleProducts,
  getCategories,
  getCategoryById,
} from "./products";
