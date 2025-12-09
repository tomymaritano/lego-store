"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { es, type Translations } from "./locales/es";
import { en } from "./locales/en";

export type Locale = "es" | "en";

const translations: Record<Locale, Translations> = {
  es,
  en,
};

interface I18nContextType {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  defaultLocale?: Locale;
}

export function I18nProvider({ children, defaultLocale = "es" }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    // Optionally persist to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("locale", newLocale);
    }
  }, []);

  const value: I18nContextType = {
    locale,
    t: translations[locale],
    setLocale,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}

// Export types for consumers
export type { Translations };
export { translations };
