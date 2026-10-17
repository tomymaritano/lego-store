import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Theme } from "@/types";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { isRecord, persistStorage } from "./persist";

/**
 * The single source of truth for the theme preference. It does not touch the
 * DOM: the inline script in <head> applies it before paint and ThemeSync keeps
 * <html> in sync afterwards (see lib/theme.ts).
 */
interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** light ⇄ dark ("system" resolves to the opposite of the current look). */
  toggleTheme: () => void;
}

const isTheme = (value: unknown): value is Theme => value === "light" || value === "dark" || value === "system";

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => {
        const current = get().theme;
        const isDark =
          current === "dark" ||
          (current === "system" &&
            typeof document !== "undefined" &&
            document.documentElement.classList.contains("dark"));
        set({ theme: isDark ? "light" : "dark" });
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(persistStorage),
      skipHydration: true,
      partialize: (state) => ({ theme: state.theme }),
      migrate: (persisted) => ({
        theme: isRecord(persisted) && isTheme(persisted.theme) ? persisted.theme : "system",
      }),
    }
  )
);
