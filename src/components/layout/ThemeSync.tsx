"use client";

import { useLayoutEffect } from "react";
import { useStoresHydrated, useThemeStore } from "@/stores";
import { applyTheme, watchSystemTheme } from "@/lib/theme";

/**
 * Keeps <html class="dark"> in sync with the theme store after hydration (the
 * inline <head> script handled the first paint). Layout effect, so a change
 * is applied before the browser paints; also re-applies after React's dev
 * remount resets <html> attributes.
 */
export function ThemeSync() {
  const hydrated = useStoresHydrated();
  const theme = useThemeStore((state) => state.theme);

  useLayoutEffect(() => {
    // Before the store has read localStorage it holds the default, not the
    // user's choice: leave what the inline script applied.
    if (!hydrated) return;
    applyTheme(theme);
    if (theme !== "system") return;
    return watchSystemTheme(() => applyTheme("system"));
  }, [hydrated, theme]);

  return null;
}
