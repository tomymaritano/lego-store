import type { Theme } from "@/types";

/**
 * Theme application. The preference lives in the theme store (persisted under
 * THEME_STORAGE_KEY); this module turns it into the `dark` class on <html>.
 *
 * Two callers, one rule (resolveDark):
 * - THEME_SCRIPT runs inline in <head> before first paint (no flash).
 * - ThemeSync (client) re-applies after hydration, on change and when the
 *   system preference changes.
 */

export const THEME_STORAGE_KEY = "lego-theme-storage";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function resolveDark(theme: Theme, systemDark: boolean): boolean {
  return theme === "dark" || (theme === "system" && systemDark);
}

export function applyTheme(theme: Theme): void {
  const dark = resolveDark(theme, window.matchMedia(DARK_QUERY).matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

export function watchSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * Inline <head> script: same logic as applyTheme, reading the persisted store
 * ({ state: { theme }, version }) directly. Kept tiny and dependency-free.
 */
export const THEME_SCRIPT = `(function(){try{var t="system",s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(s){var p=JSON.parse(s);if(p&&p.state&&(p.state.theme==="light"||p.state.theme==="dark"))t=p.state.theme}var d=t==="dark"||(t==="system"&&matchMedia(${JSON.stringify(
  DARK_QUERY
)}).matches),r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;
