"use client";

import { useEffect, useState } from "react";

/*
 * The store's theme for a payment provider's iframe (Stripe's Payment
 * Element, Mercado Pago's Payment Brick). An iframe cannot read our CSS
 * variables, so each provider's styling function gets their resolved values
 * from <html> at that moment, light or dark (the same variables change with
 * the theme), and is read again whenever the theme changes.
 */

export interface ThemeTokens {
  /** Whether the dark theme is on (the `dark` class on <html>). */
  dark: boolean;
  /** A token's resolved value ("--fg" -> "rgb(…)"); "" when it is not defined. */
  token(name: string): string;
}

export function readThemeTokens(): ThemeTokens {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  return { dark: root.classList.contains("dark"), token: (name) => styles.getPropertyValue(name).trim() };
}

/**
 * `read(theme)` now, and again whenever the theme changes; null before the
 * first read (on the server, and in the first render). `read` must be stable
 * (a module-level function).
 */
export function useThemed<T>(read: (theme: ThemeTokens) => T): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    const update = () => setValue(() => read(readThemeTokens()));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [read]);
  return value;
}
