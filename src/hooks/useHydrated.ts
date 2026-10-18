"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False in the server HTML and during hydration, true once React runs in the
 * browser. Controls that only work through JavaScript (a form submitted by
 * hand, a dialog trigger) stay disabled until then, so a click that lands
 * before hydration does nothing harmful (a native GET submit of the form).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
