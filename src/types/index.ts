// Product Types
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

// Cart Types
export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  stock: number;
}

export interface CartState {
  cart: CartItem[];
  addItem: (item: Product, quantity: number) => void;
  removeItem: (id: string) => void;
  increaseQuantity: (id: string) => void;
  decreaseQuantity: (id: string) => void;
  clearCart: () => void;
  isInCart: (id: string) => boolean;
  getTotalQuantity: () => number;
  getTotalPrice: () => number;
}

// Wishlist Types
export interface WishlistItem {
  id: string;
  name: string;
  price: number;
  image: string;
  stock: number;
  category: string;
}

export interface WishlistState {
  wishlist: WishlistItem[];
  addToWishlist: (item: Product) => void;
  removeFromWishlist: (id: string) => void;
  clearWishlist: () => void;
  isInWishlist: (id: string) => boolean;
  getTotalWishlistQuantity: () => number;
}

// Filter Types
export interface ProductFilters {
  type: string[];
  age: string[];
  theme: string[];
  interests: string[];
  pieces: string[];
  highlight: string[];
}

export interface FilterConfig {
  label: string;
  key: keyof ProductFilters;
  options: string[];
}

export type SortOption =
  | "recommended"
  | "price_low_high"
  | "price_high_low"
  | "name_asc"
  | "name_desc";

// Pagination Types
export interface PaginatedResponse<T> {
  products: T[];
  total: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  categoryId?: string;
  filters?: ProductFilters;
  sortOption?: SortOption;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  error?: string;
}
