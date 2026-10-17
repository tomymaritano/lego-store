"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/** true on the client after hydration, false during SSR and the hydration pass. */
export function useHydration() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
