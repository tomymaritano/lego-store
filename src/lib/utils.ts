import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge our custom theme keys so e.g. `text-label text-fg`
// keeps both classes (size + colour) instead of treating both as colours,
// and `duration-fast duration-base` resolves to the last one.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["caption", "label", "body", "title", "display"] }],
      shadow: [{ shadow: ["card"] }],
      // Motion tokens from globals.css, so `cn(base, className)` overrides them.
      duration: [{ duration: ["fast", "base", "slow"] }],
      ease: [{ ease: ["standard", "emphasized", "exit"] }],
      animate: [{ animate: ["shimmer"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(price);
}

export function calculateDiscount(originalPrice: number, currentPrice: number): number {
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}

/** Fallback product image (a broken or missing URL). */
export const PLACEHOLDER_IMAGE = "/images/lego.png";

/**
 * "1 producto", "3 productos". Spanish plural for UI copy; pass the plural
 * when it is not just singular + "s".
 */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
