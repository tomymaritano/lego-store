import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product } from "@/types";

export interface WishlistItem {
  id: string;
  name: string;
  price: number;
  image: string;
  stock: number;
  category: string;
}

interface WishlistState {
  wishlist: WishlistItem[];
  addToWishlist: (item: Product) => void;
  removeFromWishlist: (id: string) => void;
  clearWishlist: () => void;
  isInWishlist: (id: string) => boolean;
  getTotalWishlistQuantity: () => number;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      wishlist: [],

      addToWishlist: (item: Product) => {
        set((state) => {
          if (state.wishlist.some((i) => i.id === item.id)) {
            return state;
          }

          const newItem: WishlistItem = {
            id: item.id,
            name: item.name,
            price: item.price,
            image: item.img,
            stock: item.stock,
            category: item.category,
          };

          return { wishlist: [...state.wishlist, newItem] };
        });
      },

      removeFromWishlist: (id: string) => {
        set((state) => ({
          wishlist: state.wishlist.filter((item) => item.id !== id),
        }));
      },

      clearWishlist: () => set({ wishlist: [] }),

      isInWishlist: (id: string) => get().wishlist.some((item) => item.id === id),

      getTotalWishlistQuantity: () => get().wishlist.length,
    }),
    {
      name: "lego-wishlist-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ wishlist: state.wishlist }),
    }
  )
);
