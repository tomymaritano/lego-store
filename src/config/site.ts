/**
 * What the code fixes about the store: identity (metadata), locale and the
 * return / delivery promises. What an admin changes (shipping cost and
 * free-shipping threshold, the announcement bar, contact details, social
 * profiles) lives in the database: src/lib/settings.
 */
export const siteConfig = {
  name: "LEGO Store",
  description:
    "La mejor tienda de sets LEGO. Encuentra helmets, brickheadz, vehículos y coleccionables de Star Wars, Marvel, Disney y más.",
  /** Absolute origin for canonical URLs and Open Graph (set NEXT_PUBLIC_SITE_URL in production). */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** Language of the UI and Open Graph locale (prices use the same locale). */
  locale: "es_AR",
  seo: {
    titleTemplate: "%s | LEGO Store",
    defaultTitle: "LEGO Store | Tienda Oficial de Sets LEGO",
    keywords: ["LEGO", "tienda", "sets", "coleccionables", "Star Wars", "Marvel", "Disney", "Harry Potter", "helmets", "brickheadz"],
  },
  commerce: {
    /** Days a customer has to return an order. */
    returnDays: 30,
    /** Business days for standard delivery (min–max). */
    deliveryDays: { min: 3, max: 7 },
  },
} as const;
