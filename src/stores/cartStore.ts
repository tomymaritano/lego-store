import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem, ProductSummary } from "@/types";
import { linesSubtotal } from "@/lib/pricing";
import { sendWrite } from "./listsRemote";
import { PLACEHOLDER_IMAGE, isRecord, persistStorage } from "./persist";
import { insertAt, positionIn, type RestorePosition } from "./restorePosition";

/*
 * The cart. A visitor's lives only here (localStorage). Once signed in, this
 * is the browser's copy of the account's cart: `owner` is the user id, every
 * change is also sent to the server (./listsRemote.ts) and the server's answer
 * wins. <ListsSync /> merges, loads and clears the copy on login and logout.
 */

interface CartState {
  cart: CartItem[];
  /** The user whose server cart this is a copy of; null for a visitor's own cart. */
  owner: string | null;
  /** Adds `quantity` units (clamped to stock); merges with an existing line. */
  addItem: (product: ProductSummary, quantity?: number) => void;
  removeItem: (id: string) => void;
  increaseQuantity: (id: string) => void;
  decreaseQuantity: (id: string) => void;
  /** Sets an exact quantity, clamped to [1, stock]. */
  setQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  /**
   * Puts a removed line back (undo), at `at` when given (see RestorePosition).
   * No-op when the product already has a line again.
   */
  restoreItem: (line: CartItem, at?: RestorePosition) => void;
  /** Replaces the whole cart (the server's, or a visitor's after a logout) and who owns it. */
  replaceCart: (cart: CartItem[], owner: string | null) => void;
  /**
   * Adopts fresh catalogue data for the lines in `requestedIds` (name, price,
   * picture, stock), capping quantities; those whose product is gone or sold
   * out are dropped. For a visitor's cart, whose lines are snapshots.
   */
  refreshLines: (products: ProductSummary[], requestedIds: string[]) => void;
}

const clamp = (quantity: number, stock: number) => Math.min(stock, Math.max(1, Math.round(quantity)));

type SetCart = (update: (state: CartState) => Partial<CartState>) => void;

/** The server's version of a line replaces the local one, in place. */
const adoptLine = (set: SetCart, line: CartItem) =>
  set((state) =>
    state.cart.some((item) => item.id === line.id)
      ? { cart: state.cart.map((item) => (item.id === line.id ? line : item)) }
      : {}
  );

/** Puts line `id` back as it was in `before` (or removes it if it was not there). */
const restoreFrom = (set: SetCart, before: CartItem[], id: string) =>
  set((state) => {
    const without = state.cart.filter((item) => item.id !== id);
    const previous = before.find((item) => item.id === id);
    if (!previous) return { cart: without };
    const at = positionIn(
      before.map((item) => item.id),
      id
    );
    return { cart: insertAt(without, previous, (item) => item.id, at) };
  });

/** Sends the line's new quantity to the server when the cart belongs to an account. */
function syncQuantity(set: SetCart, state: CartState, before: CartItem[], id: string) {
  if (!state.owner) return;
  const line = state.cart.find((item) => item.id === id);
  const previous = before.find((item) => item.id === id);
  if (!line || line.quantity === previous?.quantity) return;
  sendWrite(`cart:${id}`, (remote) => remote.setCartQuantity(id, line.quantity), {
    apply: (fresh) => adoptLine(set, fresh),
    rollback: () => restoreFrom(set, before, id),
  });
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],
      owner: null,

      addItem: (product, quantity = 1) => {
        const before = get().cart;
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
        });
        const state = get();
        if (!state.owner || state.cart === before) return;
        // The server adds to its own line (another device may have added too) and caps by stock.
        const added = Math.max(1, Math.round(quantity));
        sendWrite(`cart:${product.id}`, (remote) => remote.addToCart(product.id, added), {
          apply: (fresh) => adoptLine(set, fresh),
          rollback: () => restoreFrom(set, before, product.id),
        });
      },

      removeItem: (id) => {
        const before = get().cart;
        if (!before.some((line) => line.id === id)) return;
        set((state) => ({ cart: state.cart.filter((line) => line.id !== id) }));
        if (!get().owner) return;
        sendWrite(`cart:${id}`, (remote) => remote.removeFromCart(id), {
          apply: () => {},
          rollback: () => restoreFrom(set, before, id),
        });
      },

      increaseQuantity: (id) => {
        const before = get().cart;
        set((state) => ({
          cart: state.cart.map((line) =>
            line.id === id && line.quantity < line.stock ? { ...line, quantity: line.quantity + 1 } : line
          ),
        }));
        syncQuantity(set, get(), before, id);
      },

      decreaseQuantity: (id) => {
        const before = get().cart;
        set((state) => ({
          cart: state.cart.map((line) =>
            line.id === id && line.quantity > 1 ? { ...line, quantity: line.quantity - 1 } : line
          ),
        }));
        syncQuantity(set, get(), before, id);
      },

      setQuantity: (id, quantity) => {
        const before = get().cart;
        set((state) => ({
          cart: state.cart.map((line) => (line.id === id ? { ...line, quantity: clamp(quantity, line.stock) } : line)),
        }));
        syncQuantity(set, get(), before, id);
      },

      clearCart: () => {
        const before = get().cart;
        set({ cart: [] });
        if (!get().owner || before.length === 0) return;
        sendWrite("cart:*", (remote) => remote.clearCart(), {
          apply: () => {},
          // Lines added since the clear stay; the cleared ones come back in front of them.
          rollback: () =>
            set((state) => ({
              cart: [...before.filter((line) => !state.cart.some((item) => item.id === line.id)), ...state.cart],
            })),
        });
      },

      restoreItem: (line, at) => {
        const before = get().cart;
        if (before.some((item) => item.id === line.id)) return;
        set((state) => ({ cart: insertAt(state.cart, line, (item) => item.id, at) }));
        if (!get().owner) return;
        sendWrite(`cart:${line.id}`, (remote) => remote.setCartQuantity(line.id, line.quantity), {
          apply: (fresh) => adoptLine(set, fresh),
          rollback: () => restoreFrom(set, before, line.id),
        });
      },

      replaceCart: (cart, owner) => set({ cart, owner }),

      refreshLines: (products, requestedIds) =>
        set((state) => {
          const fresh = new Map(products.map((product) => [product.id, product]));
          const requested = new Set(requestedIds);
          const cart = state.cart.flatMap((line): CartItem[] => {
            if (!requested.has(line.id)) return [line];
            const product = fresh.get(line.id);
            if (!product || product.stock <= 0) return [];
            return [
              {
                id: line.id,
                name: product.name,
                price: product.price,
                image: product.img,
                stock: product.stock,
                quantity: Math.min(line.quantity, product.stock),
              },
            ];
          });
          return { cart };
        }),
    }),
    {
      name: "lego-cart-storage",
      version: 1,
      storage: createJSONStorage(persistStorage),
      skipHydration: true,
      // `owner` came without a version bump: a stored cart without one is a visitor's (null).
      partialize: (state) => ({ cart: state.cart, owner: state.owner }),
      merge: (persisted, current) => ({
        ...current,
        cart: sanitizeCart(isRecord(persisted) ? persisted.cart : undefined),
        owner: isRecord(persisted) && typeof persisted.owner === "string" ? persisted.owner : null,
      }),
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
  useCartStore((state) => linesSubtotal(state.cart));

export const useIsInCart = (id: string) => useCartStore((state) => state.cart.some((line) => line.id === id));

/** Units of one product already in the cart (0 when it has no line). */
export const useCartQuantity = (id: string) =>
  useCartStore((state) => state.cart.find((line) => line.id === id)?.quantity ?? 0);
