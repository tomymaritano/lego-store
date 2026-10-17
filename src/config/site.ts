import { FREE_SHIPPING_FROM, SHIPPING_COST } from "@/lib/pricing";

/**
 * Store-wide settings: identity (metadata), locale, contact details and
 * commerce rules. Read by the root layout (metadata), the shell (Navbar,
 * Footer), the info pages, checkout and the shipping copy.
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
  contact: {
    email: "hola@legostore.com",
    phone: "+54 11 4000-5346",
    phoneHref: "tel:+541140005346",
    address: "Buenos Aires, Argentina",
    hours: "Lunes a viernes de 9 a 18 h",
  },
  /** Official LEGO profiles (the store is a demo: it has no accounts of its own). */
  social: [
    { name: "Facebook", href: "https://www.facebook.com/LEGO" },
    { name: "Instagram", href: "https://www.instagram.com/lego/" },
    { name: "YouTube", href: "https://www.youtube.com/@LEGO" },
    { name: "X", href: "https://x.com/LEGO_Group" },
  ],
  commerce: {
    /** Orders at or above this subtotal ship free (rules live in lib/pricing). */
    freeShippingThreshold: FREE_SHIPPING_FROM,
    shippingCost: SHIPPING_COST,
    /** Days a customer has to return an order. */
    returnDays: 30,
    /** Business days for standard delivery (min–max). */
    deliveryDays: { min: 3, max: 7 },
  },
} as const;
