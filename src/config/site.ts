/**
 * Site Configuration
 *
 * Centralized configuration for the entire application.
 * Edit this file to customize the store for your needs.
 */

export const siteConfig = {
  // Basic Info
  name: "LEGO Store",
  description: "La mejor tienda de sets LEGO. Encuentra helmets, brickheadz, vehículos y coleccionables.",
  url: "https://legostore.example.com",

  // Localization
  locale: "es-MX",
  currency: "MXN",
  currencySymbol: "$",

  // Theme
  theme: {
    primaryColor: "lego-yellow",
    accentColor: "lego-red",
  },

  // Contact Information
  contact: {
    email: "hola@legostore.com",
    phone: "+52 55 1234 5678",
    address: "Ciudad de México, México",
  },

  // Social Media Links
  social: {
    facebook: "https://facebook.com/legostore",
    twitter: "https://twitter.com/legostore",
    instagram: "https://instagram.com/legostore",
    youtube: "https://youtube.com/legostore",
  },

  // Store Features
  features: {
    freeShippingThreshold: 5000, // Free shipping over this amount
    maxCompareItems: 4,
    maxCartItems: 99,
  },

  // SEO Defaults
  seo: {
    titleTemplate: "%s | LEGO Store",
    defaultTitle: "LEGO Store | Tienda Oficial de Sets LEGO",
    keywords: ["LEGO", "tienda", "sets", "coleccionables", "Star Wars", "Marvel", "Disney", "Harry Potter"],
  },

  // Analytics (set your IDs here)
  analytics: {
    googleAnalyticsId: "",
    facebookPixelId: "",
  },
} as const;

export type SiteConfig = typeof siteConfig;
