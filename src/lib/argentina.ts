/** Shipping is domestic only for now. */
export const SHIPPING_COUNTRY = "Argentina";

/** The store's time zone: calendar dates shown to customers (a review's date) are in it. */
export const STORE_TIME_ZONE = "America/Argentina/Buenos_Aires";

/** The 23 provinces plus the autonomous city, as used for address-level1. */
export const ARGENTINA_PROVINCES = [
  "Ciudad Autónoma de Buenos Aires",
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const;
