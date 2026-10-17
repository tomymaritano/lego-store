import { siteConfig } from "@/config/site";
import { PLACEHOLDER_IMAGE } from "@/lib/utils";
import type { Product } from "@/types";

const absolute = (path: string) => new URL(path, siteConfig.url).toString();

/** The product's real pictures (main first, no duplicates, never the placeholder). */
export function productImages(product: Pick<Product, "img" | "images">): string[] {
  return Array.from(new Set([product.img, ...product.images])).filter((src) => src && src !== PLACEHOLDER_IMAGE);
}

/**
 * schema.org Product for the product page (rich results). Ratings are left
 * out on purpose: reviews are client-side mock data until the backend lands,
 * so there is no trustworthy review count to publish.
 */
export function productJsonLd(product: Product, categoryName?: string) {
  const url = absolute(`/item/${product.id}`);
  const images = productImages(product).map(absolute);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": url,
    sku: product.id,
    name: product.name,
    description: product.description,
    ...(images.length > 0 && { image: images }),
    brand: { "@type": "Brand", name: "LEGO" },
    ...(categoryName && { category: categoryName }),
    offers: {
      "@type": "Offer",
      url,
      price: product.price,
      priceCurrency: "ARS",
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: siteConfig.name },
    },
  };
}

/** Serialises JSON-LD for a <script> tag; `<` is escaped so the data can never close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
