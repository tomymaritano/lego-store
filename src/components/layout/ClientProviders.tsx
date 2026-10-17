"use client";

import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { transitions } from "@/lib/motion";
import { CompareBar } from "@/components/product";
import { useThemeStore } from "@/stores";

/**
 * Client-only app shell: applies the theme class and sets the global motion
 * policy (animations respect prefers-reduced-motion everywhere, and any motion
 * element without its own transition uses the token timing, transitions.base).
 */
export function ClientProviders({ children }: { children: ReactNode }) {
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

  return (
    <MotionConfig reducedMotion="user" transition={transitions.base}>
      {children}
      <CompareBar />
    </MotionConfig>
  );
}
