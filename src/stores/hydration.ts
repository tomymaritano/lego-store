"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useCartStore } from "./cartStore";
import { useCompareStore } from "./compareStore";
import { useRecentlyViewedStore } from "./recentlyViewedStore";
import { useThemeStore } from "./themeStore";
import { useWishlistStore } from "./wishlistStore";

/*
 * Persisted stores are created with `skipHydration`, so the server render and
 * the first client render both see the defaults (empty cart, "system" theme)
 * and match. <StoreHydrator /> then reads localStorage once, right after
 * hydration, for every store at the same time. Components that must tell
 * "still loading" apart from "empty" (cart page, checkout) ask
 * useStoresHydrated(); everything else just renders the store value.
 */

const persistedStores = [
  useCartStore,
  useWishlistStore,
  useCompareStore,
  useRecentlyViewedStore,
  useThemeStore,
];

/** Keys of stores that no longer exist; their leftovers are removed from localStorage. */
const RETIRED_KEYS = [
  // Reviews and "útil" votes live in the database since the reviews stage.
  "lego-reviews-storage",
];

function rehydrateAll() {
  for (const store of persistedStores) void store.persist.rehydrate();
}

function subscribe(onChange: () => void) {
  const unsubscribers = persistedStores.map((store) => store.persist.onFinishHydration(onChange));
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

const allHydrated = () => persistedStores.every((store) => store.persist.hasHydrated());

/** False on the server and until StoreHydrator has loaded localStorage. */
export function useStoresHydrated(): boolean {
  return useSyncExternalStore(subscribe, allHydrated, () => false);
}

type PersistedStore = (typeof persistedStores)[number];

/** Like useStoresHydrated, for a single store. */
export function useStoreHydrated(store: PersistedStore): boolean {
  return useSyncExternalStore(
    (onChange) => store.persist.onFinishHydration(onChange),
    () => store.persist.hasHydrated(),
    () => false
  );
}

/**
 * Mount once at the root. Loads persisted state after hydration and keeps
 * tabs in sync: a change in another tab rehydrates the matching store.
 */
export function StoreHydrator() {
  useEffect(() => {
    rehydrateAll();
    try {
      for (const key of RETIRED_KEYS) window.localStorage.removeItem(key);
    } catch {
      // Storage blocked (private mode, settings): nothing to clean up.
    }

    const onStorage = (event: StorageEvent) => {
      const store = persistedStores.find((s) => s.persist.getOptions().name === event.key);
      if (store) void store.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}
