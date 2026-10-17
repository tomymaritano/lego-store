import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idsFrom, isRecord, persistStorage } from "./persist";

export const MAX_RECENTLY_VIEWED = 10;

interface RecentlyViewedState {
  /** Product ids, most recent first. */
  ids: string[];
  /** Moves (or adds) the id to the front. */
  addItem: (id: string) => void;
  clearAll: () => void;
  /** Drops ids the catalogue no longer knows (see useProductsByIds). */
  removeMany: (ids: string[]) => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      ids: [],
      addItem: (id) =>
        set((state) => ({ ids: [id, ...state.ids.filter((item) => item !== id)].slice(0, MAX_RECENTLY_VIEWED) })),
      clearAll: () => set({ ids: [] }),
      removeMany: (ids) => set((state) => ({ ids: state.ids.filter((item) => !ids.includes(item)) })),
    }),
    {
      name: "lego-recently-viewed",
      version: 1,
      storage: createJSONStorage(persistStorage),
      skipHydration: true,
      partialize: (state) => ({ ids: state.ids }),
      // v0 stored full product snapshots in `items`; keep only their ids.
      migrate: (persisted) => ({
        ids: idsFrom(isRecord(persisted) ? (persisted.ids ?? persisted.items) : undefined, MAX_RECENTLY_VIEWED),
      }),
    }
  )
);

export const useRecentlyViewedIds = () => useRecentlyViewedStore((state) => state.ids);
