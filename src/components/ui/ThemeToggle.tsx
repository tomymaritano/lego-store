"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import { useStoreHydrated, useThemeStore } from "@/stores";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { IconButton } from "./IconButton";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

const themeLabels = { light: "Claro", dark: "Oscuro", system: "Sistema" } as const;
const icons = { light: Sun, dark: Moon, system: Monitor } as const;

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  // Until the persisted preference is loaded the store holds the default,
  // so render a placeholder instead of a possibly wrong icon.
  const hydrated = useStoreHydrated(useThemeStore);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  if (!hydrated) {
    return <div aria-hidden="true" className={cn("size-10 rounded-full bg-bg-muted", className)} />;
  }

  const Icon = icons[theme];

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <IconButton
        label={`Cambiar tema (actual: ${themeLabels[theme].toLowerCase()})`}
        onClick={toggleTheme}
        data-testid="theme-toggle"
        className="overflow-hidden"
      >
        <AnimatePresence mode="wait" initial={false}>
          <m.span
            key={theme}
            className="flex"
            initial={{ scale: 0.5, rotate: -90, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.5, rotate: 90, opacity: 0 }}
            transition={transitions.fast}
          >
            <Icon aria-hidden="true" className="size-5" />
          </m.span>
        </AnimatePresence>
      </IconButton>

      {showLabel && <span className="ml-2 text-sm text-fg-secondary">{themeLabels[theme]}</span>}
    </div>
  );
}
