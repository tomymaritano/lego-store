import type { StateStorage } from "zustand/middleware";

export { PLACEHOLDER_IMAGE } from "@/lib/utils";

/**
 * localStorage when it exists. During SSR (and in node tests) there is none,
 * so persist gets a no-op storage instead of crashing; the stores use
 * `skipHydration` and are rehydrated once on the client by StoreHydrator.
 */
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const persistStorage = (): StateStorage =>
  typeof window !== "undefined" && window.localStorage ? window.localStorage : noopStorage;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Ids from an array of strings or of objects with an `id` (older persisted shapes). */
export function idsFrom(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map((item) => (typeof item === "string" ? item : isRecord(item) && typeof item.id === "string" ? item.id : null))
    .filter((id): id is string => !!id);
  return Array.from(new Set(ids)).slice(0, max);
}

