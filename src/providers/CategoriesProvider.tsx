"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Category } from "@/types";

export type CategoryRef = Pick<Category, "id" | "name">;

const CategoriesContext = createContext<readonly CategoryRef[]>([]);

/**
 * Makes the category list (read once by the root layout through lib/api)
 * available to client islands, so they show display names ("Vehículos")
 * instead of slugs ("cars") without another request.
 */
export function CategoriesProvider({ categories, children }: { categories: readonly CategoryRef[]; children: ReactNode }) {
  return <CategoriesContext.Provider value={categories}>{children}</CategoriesContext.Provider>;
}

export function useCategories(): readonly CategoryRef[] {
  return useContext(CategoriesContext);
}

/** Display name for a category slug; falls back to the slug when unknown. */
export function useCategoryName(id: string): string {
  return useCategories().find((category) => category.id === id)?.name ?? id;
}

/** Inline display name for a category slug (usable inside render callbacks). */
export function CategoryName({ id }: { id: string }) {
  return <>{useCategoryName(id)}</>;
}
