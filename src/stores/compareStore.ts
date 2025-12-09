import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product } from "@/types";

const MAX_COMPARE_ITEMS = 4;

interface CompareState {
  items: Product[];
  addToCompare: (product: Product) => boolean;
  removeFromCompare: (productId: string) => void;
  clearCompare: () => void;
  isInCompare: (productId: string) => boolean;
  canAddMore: () => boolean;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      items: [],

      addToCompare: (product) => {
        const state = get();
        if (state.items.length >= MAX_COMPARE_ITEMS) {
          return false;
        }
        if (state.isInCompare(product.id)) {
          return false;
        }
        set({ items: [...state.items, product] });
        return true;
      },

      removeFromCompare: (productId) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== productId),
        }));
      },

      clearCompare: () => set({ items: [] }),

      isInCompare: (productId) => {
        return get().items.some((item) => item.id === productId);
      },

      canAddMore: () => {
        return get().items.length < MAX_COMPARE_ITEMS;
      },
    }),
    {
      name: "lego-compare-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
