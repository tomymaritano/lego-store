import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem, ProductSummary } from "@/types";
import { PLACEHOLDER_IMAGE, isRecord, persistStorage } from "./persist";

interface CartState {
  cart: CartItem[];
  /** Adds `quantity` units (clamped to stock); merges with an existing line. */
  addItem: (product: ProductSummary, quantity?: number) => void;
  removeItem: (id: string) => void;
  increaseQuantity: (id: string) => void;
  decreaseQuantity: (id: string) => void;
  /** Sets an exact quantity, clamped to [1, stock]. */
  setQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  /**
   * Puts a removed line back (undo), at `index` when given. No-op when the
   * product already has a line again.
   */
  restoreItem: (line: CartItem, index?: number) => void;
}

const clamp = (quantity: number, stock: number) => Math.min(stock, Math.max(1, Math.round(quantity)));

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      cart: [],

      addItem: (product, quantity = 1) =>
        set((state) => {
          if (product.stock <= 0) return state;
          const existing = state.cart.find((i) => i.id === product.id);
          if (existing) {
            return {
              cart: state.cart.map((line) =>
                line.id === product.id ? { ...line, quantity: clamp(line.quantity + quantity, line.stock) } : line
              ),
            };
          }
          const line: CartItem = {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.img,
            quantity: clamp(quantity, product.stock),
            stock: product.stock,
          };
          return { cart: [...state.cart, line] };
        }),

      removeItem: (id) => set((state) => ({ cart: state.cart.filter((line) => line.id !== id) })),

      increaseQuantity: (id) =>
        set((state) => ({
          cart: state.cart.map((line) =>
            line.id === id && line.quantity < line.stock ? { ...line, quantity: line.quantity + 1 } : line
          ),
        })),

      decreaseQuantity: (id) =>
        set((state) => ({
          cart: state.cart.map((line) =>
            line.id === id && line.quantity > 1 ? { ...line, quantity: line.quantity - 1 } : line
          ),
        })),

      setQuantity: (id, quantity) =>
        set((state) => ({
          cart: state.cart.map((line) => (line.id === id ? { ...line, quantity: clamp(quantity, line.stock) } : line)),
        })),

      clearCart: () => set({ cart: [] }),

      restoreItem: (line, index) =>
        set((state) => {
          if (state.cart.some((item) => item.id === line.id)) return state;
          const cart = [...state.cart];
          cart.splice(index ?? cart.length, 0, line);
          return { cart };
        }),
    }),
    {
      name: "lego-cart-storage",
      version: 1,
      storage: createJSONStorage(persistStorage),
      skipHydration: true,
      partialize: (state) => ({ cart: state.cart }),
      // v0 had the same line shape but no version; keep only well-formed lines.
      migrate: (persisted) => ({ cart: sanitizeCart(isRecord(persisted) ? persisted.cart : undefined) }),
    }
  )
);

function sanitizeCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (line): line is CartItem =>
        isRecord(line) &&
        typeof line.id === "string" &&
        typeof line.name === "string" &&
        typeof line.price === "number" &&
        typeof line.quantity === "number" &&
        typeof line.stock === "number"
    )
    .map((line) => ({ ...line, image: typeof line.image === "string" && line.image ? line.image : PLACEHOLDER_IMAGE }));
}

// ---- Selectors -------------------------------------------------------------
// Return primitives (or the stored array) so components re-render only when
// the value they show changes.

export const useCartItems = () => useCartStore((state) => state.cart);

/** Total units in the cart (badge). */
export const useCartCount = () => useCartStore((state) => state.cart.reduce((sum, line) => sum + line.quantity, 0));

export const useCartSubtotal = () =>
  useCartStore((state) => state.cart.reduce((sum, line) => sum + line.quantity * line.price, 0));

export const useIsInCart = (id: string) => useCartStore((state) => state.cart.some((line) => line.id === id));

/** Units of one product already in the cart (0 when it has no line). */
export const useCartQuantity = (id: string) =>
  useCartStore((state) => state.cart.find((line) => line.id === id)?.quantity ?? 0);
