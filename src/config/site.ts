/**
 * Store-wide settings: identity (metadata), locale and commerce rules.
 * Read by the root layout (metadata), checkout and the shipping copy.
 */
export const siteConfig = {
  name: "LEGO Store",
  description:
    "La mejor tienda de sets LEGO. Encuentra helmets, brickheadz, vehículos y coleccionables de Star Wars, Marvel, Disney y más.",
  /** Language of the UI and Open Graph locale (prices use the same locale). */
  locale: "es_AR",
  seo: {
    titleTemplate: "%s | LEGO Store",
    defaultTitle: "LEGO Store | Tienda Oficial de Sets LEGO",
    keywords: ["LEGO", "tienda", "sets", "coleccionables", "Star Wars", "Marvel", "Disney", "Harry Potter", "helmets", "brickheadz"],
  },
  commerce: {
    /** Orders at or above this subtotal ship free. */
    freeShippingThreshold: 5000,
    shippingCost: 299,
  },
} as const;
