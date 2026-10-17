import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ProductSummary, WishlistItem } from "@/types";
import { PLACEHOLDER_IMAGE, isRecord, persistStorage } from "./persist";

interface WishlistState {
  wishlist: WishlistItem[];
  addToWishlist: (product: ProductSummary) => void;
  removeFromWishlist: (id: string) => void;
  /** Adds or removes; returns true when the product ends up in the wishlist. */
  toggleWishlist: (product: ProductSummary) => boolean;
  clearWishlist: () => void;
  /** Drops products the catalogue no longer knows (see useProductsByIds). */
  removeMany: (ids: string[]) => void;
}

const snapshot = ({ id, name, price, img, stock }: ProductSummary): WishlistItem => ({
  id,
  name,
  price,
  image: img,
  stock,
});

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      wishlist: [],

      addToWishlist: (product) =>
        set((state) =>
          state.wishlist.some((item) => item.id === product.id)
            ? state
            : { wishlist: [...state.wishlist, snapshot(product)] }
        ),

      removeFromWishlist: (id) => set((state) => ({ wishlist: state.wishlist.filter((item) => item.id !== id) })),

      toggleWishlist: (product) => {
        const inWishlist = get().wishlist.some((item) => item.id === product.id);
        if (inWishlist) get().removeFromWishlist(product.id);
        else get().addToWishlist(product);
        return !inWishlist;
      },

      clearWishlist: () => set({ wishlist: [] }),

      removeMany: (ids) => set((state) => ({ wishlist: state.wishlist.filter((item) => !ids.includes(item.id)) })),
    }),
    {
      name: "lego-wishlist-storage",
      version: 1,
      storage: createJSONStorage(persistStorage),
      skipHydration: true,
      partialize: (state) => ({ wishlist: state.wishlist }),
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
