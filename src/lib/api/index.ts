/**
 * The single data gateway of the app (server-only). Pages (Server Components)
 * and Route Handlers read the catalogue through these functions; they query
 * Postgres through Prisma behind the Next data cache (see ./products.ts and
 * ./cache.ts). Client islands call the Route Handlers in src/app/api through
 * @/lib/api-client.
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
  getCategoryNames,
  getCategoryRedirect,
  getThemes,
  getReviewPage,
} from "./products";
export { CATALOG_TAGS, invalidateCatalog, updateCatalog } from "./cache";
