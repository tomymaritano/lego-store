import { DEFAULT_SHIPPING_RULES, type ShippingRules } from "@/lib/pricing";

/*
 * The store's settings as the app reads them (StoreSettings, edited in
 * /admin/configuracion): shipping, the announcement bar, contact details and
 * social profiles. Client-safe and dependency-free: the root layout hands
 * them to client islands (the cart's shipping) and the shell renders them.
 * Server reads are in ./index.ts; validation in @/lib/validations/settings.
 */

/** The announcement bar's colour pairs (src/components/layout/AnnouncementBar.tsx maps them to tokens). */
export const ANNOUNCEMENT_TONES = ["BRAND", "PRIMARY", "INFO", "SUCCESS", "NEUTRAL"] as const;
export type AnnouncementTone = (typeof ANNOUNCEMENT_TONES)[number];

export const ANNOUNCEMENT_TONE_LABELS: Record<AnnouncementTone, string> = {
  BRAND: "Rojo de la marca",
  PRIMARY: "Amarillo",
  INFO: "Azul",
  SUCCESS: "Verde",
  NEUTRAL: "Neutro",
};

export interface Announcement {
  active: boolean;
  /** May use the placeholders of ./placeholders.ts ("{{envio_gratis_desde}}"). */
  text: string;
  /** A site path ("/envios") or an https URL; "" = no link. */
  linkUrl: string;
  linkLabel: string;
  tone: AnnouncementTone;
}

export interface StoreContact {
  email: string;
  phone: string;
  address: string;
  hours: string;
}

/** The networks the footer has icons for (src/components/icons/SocialIcons.tsx), in its order. */
export const SOCIAL_NETWORKS = [
  { key: "facebook", name: "Facebook" },
  { key: "instagram", name: "Instagram" },
  { key: "youtube", name: "YouTube" },
  { key: "x", name: "X" },
] as const;

export type SocialKey = (typeof SOCIAL_NETWORKS)[number]["key"];
export type SocialName = (typeof SOCIAL_NETWORKS)[number]["name"];

export interface StoreSettings {
  shipping: ShippingRules;
  announcement: Announcement;
  contact: StoreContact;
  /** Profile URLs; "" = not shown. */
  social: Record<SocialKey, string>;
}

/** What a store starts with (the seed writes these; the app falls back to them while the row is missing). */
export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  shipping: { ...DEFAULT_SHIPPING_RULES },
  announcement: {
    active: true,
    text: "Envío gratis en compras desde {{envio_gratis_desde}}",
    linkUrl: "/envios",
    linkLabel: "Ver condiciones",
    tone: "BRAND",
  },
  contact: {
    email: "hola@legostore.com",
    phone: "+54 11 4000-5346",
    address: "Buenos Aires, Argentina",
    hours: "Lunes a viernes de 9 a 18 h",
  },
  // Official LEGO profiles (the store is a demo: it has no accounts of its own).
  social: {
    facebook: "https://www.facebook.com/LEGO",
    instagram: "https://www.instagram.com/lego/",
    youtube: "https://www.youtube.com/@LEGO",
    x: "https://x.com/LEGO_Group",
  },
};

/** "tel:+541140005346" from "+54 11 4000-5346" (digits and a leading +). */
export function phoneHref(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

/** The profiles to show, in the footer's order (empty ones left out). */
export function socialLinks(social: StoreSettings["social"]): { name: SocialName; href: string }[] {
  return SOCIAL_NETWORKS.flatMap(({ key, name }) => (social[key] ? [{ name, href: social[key] }] : []));
}
