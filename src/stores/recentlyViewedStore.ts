import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product } from "@/types";

const MAX_RECENTLY_VIEWED = 10;

interface RecentlyViewedState {
  items: Product[];
  addItem: (product: Product) => void;
  clearAll: () => void;
  getItems: () => Product[];
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product: Product) => {
        set((state) => {
          // Remove if already exists
          const filtered = state.items.filter((item) => item.id !== product.id);
          // Add to beginning and limit
          const newItems = [product, ...filtered].slice(0, MAX_RECENTLY_VIEWED);
          return { items: newItems };
        });
      },

      clearAll: () => set({ items: [] }),

      getItems: () => get().items,
    }),
    {
      name: "lego-recently-viewed",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
