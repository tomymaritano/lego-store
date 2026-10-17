import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idsFrom, isRecord, persistStorage } from "./persist";
import { insertAt, type RestorePosition } from "./restorePosition";

export const MAX_COMPARE_ITEMS = 4;

type CompareResult = "added" | "removed" | "full";

interface CompareState {
  /** Product ids, in the order they were added. Products are fetched by id. */
  ids: string[];
  /** Returns false when the list is full or already has the id. */
  addToCompare: (id: string) => boolean;
  removeFromCompare: (id: string) => void;
  toggleCompare: (id: string) => CompareResult;
  clearCompare: () => void;
  /** Drops ids the catalogue no longer knows (see useProductsByIds). */
  removeMany: (ids: string[]) => void;
  /** Puts a removed id back (undo) at `at`, unless it is already there or the list is full. */
  restoreId: (id: string, at?: RestorePosition) => void;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      ids: [],

      addToCompare: (id) => {
        const { ids } = get();
        if (ids.includes(id) || ids.length >= MAX_COMPARE_ITEMS) return false;
        set({ ids: [...ids, id] });
        return true;
      },

      removeFromCompare: (id) => set((state) => ({ ids: state.ids.filter((item) => item !== id) })),

      toggleCompare: (id) => {
        if (get().ids.includes(id)) {
          get().removeFromCompare(id);
          return "removed";
        }
        return get().addToCompare(id) ? "added" : "full";
      },

      clearCompare: () => set({ ids: [] }),

      removeMany: (ids) => set((state) => ({ ids: state.ids.filter((item) => !ids.includes(item)) })),

      restoreId: (id, at) =>
        set((state) =>
          state.ids.includes(id) || state.ids.length >= MAX_COMPARE_ITEMS
            ? state
            : { ids: insertAt(state.ids, id, (item) => item, at) }
        ),
    }),
    {
      name: "lego-compare-storage",
      version: 1,
      storage: createJSONStorage(persistStorage),
      skipHydration: true,
      partialize: (state) => ({ ids: state.ids }),
      // v0 stored full product snapshots in `items`; keep only their ids.
      migrate: (persisted) => ({
        ids: idsFrom(isRecord(persisted) ? (persisted.ids ?? persisted.items) : undefined, MAX_COMPARE_ITEMS),
      }),
    }
  )
);

// ---- Selectors -------------------------------------------------------------

export const useCompareIds = () => useCompareStore((state) => state.ids);

export const useCompareCount = () => useCompareStore((state) => state.ids.length);

export const useIsInCompare = (id: string) => useCompareStore((state) => state.ids.includes(id));
