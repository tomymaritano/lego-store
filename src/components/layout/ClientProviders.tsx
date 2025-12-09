"use client";

import { useEffect } from "react";
import { CompareBar } from "@/components/product";
import { useThemeStore } from "@/stores";

export function ClientProviders() {
  const theme = useThemeStore((state) => state.theme);

  // Apply theme on mount and when theme changes
  useEffect(() => {
    const applyTheme = (theme: "light" | "dark" | "system") => {
      const root = document.documentElement;
      if (theme === "system") {
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.classList.toggle("dark", systemDark);
      } else {
        root.classList.toggle("dark", theme === "dark");
      }
    };

    applyTheme(theme);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  return <CompareBar />;
}
