import type { Product } from "@/types";

/** One picture of a gallery: its URL and alt text. */
export interface GalleryPicture {
  url: string;
  alt: string;
}

/** Main picture first, then the rest, without duplicates (what the product page shows). */
export function gallerySources(product: Pick<Product, "img" | "images">): string[] {
  return Array.from(new Set([product.img, ...product.images].filter(Boolean)));
}

/** A picture's alt text: the one the admin wrote for it (Product.imageAlts), or the product's name. */
export function galleryAlt(product: Pick<Product, "name" | "images" | "imageAlts">, src: string): string {
  const index = product.images.indexOf(src);
  return (index >= 0 ? product.imageAlts?.[index]?.trim() : "") || product.name;
}

/**
 * The gallery the admin edits: the same list the storefront shows (main
 * picture first, even when it is not in `images`), each with its alt text.
 * Seeding the editor from `images` alone would drop a main picture that is
 * only in `img` on the next save.
 */
export function galleryPictures(product: Pick<Product, "name" | "img" | "images" | "imageAlts">): GalleryPicture[] {
  return gallerySources(product).map((url) => ({ url, alt: galleryAlt(product, url) }));
}
