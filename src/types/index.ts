/**
 * Shared domain types. This is the only place they are declared: stores,
 * components, lib/api and the Route Handlers all import from here.
 * Everything is plain serialisable data so it can cross the Server → Client
 * boundary and travel as JSON through /api/*.
 */

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  isNew: boolean;
  isOnSale: boolean;
  rating: number;
  category: string;
  type: string;
  age: string;
  theme: string;
  interests: string[];
  pieces: string;
  highlight: string;
  img: string;
  imageSecondary?: string;
  images: string[];
  stock: number;
  shortDescription: string;
  description: string;
}

/**
 * The few fields a client needs to show a product in a list, a cart line or a
 * suggestion without the full record. Also the input of the cart/wishlist
 * actions, so a stored snapshot can be added back to the cart.
 */
export type ProductSummary = Pick<Product, "id" | "name" | "price" | "img" | "stock">;

/** One row of the search autocomplete. */
export type SearchSuggestion = Pick<Product, "id" | "name" | "price" | "img" | "theme">;

export interface Category {
  /** URL slug, e.g. "helmet" (matches Product.category). */
  id: string;
  name: string;
  description: string;
  image: string;
  productCount: number;
}

// ---------------------------------------------------------------------------
// Queries (filters, sort, pagination)
// ---------------------------------------------------------------------------

export type SortOption =
  | "featured"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "rating"
  | "name-asc"
  | "name-desc";

/**
 * Catalogue filters. Every list filter is OR within the list and AND across
 * lists (theme A or B, and age 18+). Missing / empty means "no filter".
 */
export interface ProductFilters {
  category?: string;
  themes?: string[];
  types?: string[];
  ages?: string[];
  interests?: string[];
  pieces?: string[];
  highlights?: string[];
  minPrice?: number;
  maxPrice?: number;
  /** Minimum rating, 0–5. */
  minRating?: number;
  inStock?: boolean;
  onSale?: boolean;
  isNew?: boolean;
}

export interface ProductQuery extends ProductFilters {
  /** Free-text search (all terms must match). */
  q?: string;
  sort?: SortOption;
  /** 1-based. */
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface FilterOption {
  value: string;
  label: string;
  /** Products in the current scope that have this value. */
  count: number;
}

export interface FilterOptions {
  categories: FilterOption[];
  themes: FilterOption[];
  types: FilterOption[];
  ages: FilterOption[];
  interests: FilterOption[];
  pieces: FilterOption[];
  highlights: FilterOption[];
  price: { min: number; max: number };
  /** Products in scope, before any filter is applied. */
  total: number;
}

// ---------------------------------------------------------------------------
// Client state (persisted in localStorage)
// ---------------------------------------------------------------------------

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  stock: number;
}

/** Minimal snapshot: enough to render the list before fresh data arrives. */
export interface WishlistItem {
  id: string;
  name: string;
  price: number;
  image: string;
  stock: number;
}

export type Theme = "light" | "dark" | "system";

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
  helpful: number;
  verified: boolean;
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export interface ShippingInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

/** Full card data: lives only in the payment form while that step is open. */
export interface PaymentInfo {
  cardNumber: string;
  cardName: string;
  expiryDate: string;
  cvv: string;
}

/** What survives the payment step: never the card number or the CVV. */
export interface PaymentSummary {
  cardName: string;
  last4: string;
  expiryDate: string;
}

export type CheckoutStep = "shipping" | "payment" | "review" | "confirmation";
