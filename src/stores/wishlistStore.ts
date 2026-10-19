import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ProductSummary, WishlistItem } from "@/types";
import { sendWrite } from "./listsRemote";
import { PLACEHOLDER_IMAGE, isRecord, persistStorage } from "./persist";
import { insertAt, positionIn, type RestorePosition } from "./restorePosition";

/*
 * Saved products. Like the cart (./cartStore.ts): a visitor's list lives only
 * here; a signed-in user's is a copy of the server's (`owner`), each change is
 * sent to the server and rolled back if it fails.
 */

interface WishlistState {
  wishlist: WishlistItem[];
  /** The user whose server wishlist this is a copy of; null for a visitor's own list. */
  owner: string | null;
  addToWishlist: (product: ProductSummary) => void;
  removeFromWishlist: (id: string) => void;
  /** Adds or removes; returns true when the product ends up in the wishlist. */
  toggleWishlist: (product: ProductSummary) => boolean;
  clearWishlist: () => void;
  /** Drops products the catalogue no longer knows (see useProductsByIds). */
  removeMany: (ids: string[]) => void;
  /** Puts a removed item back (undo), at `at` when given. No-op if it is already saved. */
  restoreItem: (item: WishlistItem, at?: RestorePosition) => void;
  /** Replaces the whole list (the server's, or empty after a logout) and who owns it. */
  replaceWishlist: (wishlist: WishlistItem[], owner: string | null) => void;
}

const snapshot = ({ id, name, price, img, stock }: ProductSummary): WishlistItem => ({
  id,
  name,
  price,
  image: img,
  stock,
});

type SetWishlist = (update: (state: WishlistState) => Partial<WishlistState>) => void;

/** Puts item `id` back as it was in `before` (or removes it if it was not there). */
const restoreFrom = (set: SetWishlist, before: WishlistItem[], id: string) =>
  set((state) => {
    const without = state.wishlist.filter((item) => item.id !== id);
    const previous = before.find((item) => item.id === id);
    if (!previous) return { wishlist: without };
    const at = positionIn(
      before.map((item) => item.id),
      id
    );
    return { wishlist: insertAt(without, previous, (item) => item.id, at) };
  });

/** Saves `item` locally (at `at`) and, for an account's list, on the server. */
function save(set: SetWishlist, get: () => WishlistState, item: WishlistItem, at?: RestorePosition) {
  const before = get().wishlist;
  if (before.some((saved) => saved.id === item.id)) return;
  set((state) => ({ wishlist: insertAt(state.wishlist, item, (saved) => saved.id, at) }));
  if (!get().owner) return;
  sendWrite(`wishlist:${item.id}`, (remote) => remote.addToWishlist(item.id), {
    apply: (fresh) =>
      set((state) => ({ wishlist: state.wishlist.map((saved) => (saved.id === fresh.id ? fresh : saved)) })),
    rollback: () => restoreFrom(set, before, item.id),
  });
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      wishlist: [],
      owner: null,

      addToWishlist: (product) => save(set, get, snapshot(product)),

      removeFromWishlist: (id) => {
        const before = get().wishlist;
        if (!before.some((item) => item.id === id)) return;
        set((state) => ({ wishlist: state.wishlist.filter((item) => item.id !== id) }));
        if (!get().owner) return;
        sendWrite(`wishlist:${id}`, (remote) => remote.removeFromWishlist(id), {
          apply: () => {},
          rollback: () => restoreFrom(set, before, id),
        });
      },

      toggleWishlist: (product) => {
        const inWishlist = get().wishlist.some((item) => item.id === product.id);
        if (inWishlist) get().removeFromWishlist(product.id);
        else get().addToWishlist(product);
        return !inWishlist;
      },

      clearWishlist: () => {
        const before = get().wishlist;
        set({ wishlist: [] });
        if (!get().owner || before.length === 0) return;
        sendWrite("wishlist:*", (remote) => remote.clearWishlist(), {
          apply: () => {},
          rollback: () =>
            set((state) => ({
              wishlist: [...before.filter((item) => !state.wishlist.some((saved) => saved.id === item.id)), ...state.wishlist],
            })),
        });
      },

      // Local only: these products are gone from the catalogue, and the database
      // already dropped them from every saved list (cascade).
      removeMany: (ids) => set((state) => ({ wishlist: state.wishlist.filter((item) => !ids.includes(item.id)) })),

      restoreItem: (item, at) => save(set, get, item, at),

      replaceWishlist: (wishlist, owner) => set({ wishlist, owner }),
    }),
    {
      name: "lego-wishlist-storage",
      version: 1,
      storage: createJSONStorage(persistStorage),
      skipHydration: true,
      // `owner` came without a version bump: a stored list without one is a visitor's (null).
      partialize: (state) => ({ wishlist: state.wishlist, owner: state.owner }),
      merge: (persisted, current) => ({
        ...current,
        wishlist: sanitizeWishlist(isRecord(persisted) ? persisted.wishlist : undefined),
        owner: isRecord(persisted) && typeof persisted.owner === "string" ? persisted.owner : null,
      }),
      // v0 stored { id, name, price, image, stock, category }: keep the minimal snapshot.
      migrate: (persisted) => ({ wishlist: sanitizeWishlist(isRecord(persisted) ? persisted.wishlist : undefined) }),
    }
  )
);

function sanitizeWishlist(value: unknown): WishlistItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((item) =>
    typeof item.id === "string" && typeof item.name === "string" && typeof item.price === "number"
      ? [
          {
            id: item.id,
            name: item.name,
            price: item.price,
            image: typeof item.image === "string" && item.image ? item.image : PLACEHOLDER_IMAGE,
            stock: typeof item.stock === "number" ? item.stock : 0,
          },
        ]
      : []
  );
}

// ---- Selectors -------------------------------------------------------------

export const useWishlistItems = () => useWishlistStore((state) => state.wishlist);

export const useWishlistCount = () => useWishlistStore((state) => state.wishlist.length);

export const useIsInWishlist = (id: string) => useWishlistStore((state) => state.wishlist.some((item) => item.id === id));
