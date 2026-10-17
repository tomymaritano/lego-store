"use client";

import { useState } from "react";

const RECENT_KEY = "lego-recent-searches";
const MAX_RECENT = 5;

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

/**
 * The visitor's last searches (newest first, case-insensitive dedupe), kept
 * in localStorage. Storage can be unavailable (private mode): recent searches
 * are a nicety, so every failure just means "no recents".
 *
 * `loadNow` reads storage on the first render (client-only surfaces such as
 * the full-screen search); otherwise call `refresh()` when the field is
 * focused, so server and client render the same markup.
 */
export function useRecentSearches(loadNow = false) {
  const [recent, setRecent] = useState<string[]>(() => (loadNow && typeof window !== "undefined" ? readRecent() : []));

  const refresh = () => setRecent(readRecent());

  const save = (query: string) => {
    try {
      const next = [query, ...readRecent().filter((s) => s.toLowerCase() !== query.toLowerCase())].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: nothing to remember.
    }
  };

  const clear = () => {
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      // Storage unavailable: nothing to clear.
    }
    setRecent([]);
  };

  return { recent, refresh, save, clear };
}
