import { z } from "zod";
import { ANNOUNCEMENT_TONES } from "@/lib/settings/defaults";
import { MAX_ANNOUNCEMENT, MAX_FEATURED, SOCIAL_FIELDS } from "./settings-limits";

export { MAX_ANNOUNCEMENT, MAX_FEATURED, SOCIAL_FIELDS };

/*
 * /admin/configuracion: the store's settings, one form per section
 * (shipping, announcement bar, contact, home featured products). As every
 * admin input, validated again on the server whatever the form did.
 */

/** Most pesos a setting may hold (a typo guard; the column is a 32-bit integer). */
export const MAX_SETTING_PESOS = 10_000_000;

const pesos = (label: string, min: number) =>
  z
    .string()
    .trim()
    .min(1, `Completa ${label}`)
    .regex(/^\d+$/, "Solo números enteros, sin puntos ni signos")
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(min, min === 1 ? "Tiene que ser al menos $1" : `Tiene que ser al menos ${min}`)
        .max(MAX_SETTING_PESOS, "Es demasiado alto: revisa el número")
    );

export const shippingSettingsSchema = z.object({
  shippingCost: pesos("el costo del envío", 1),
  freeShippingFrom: pesos("el monto para el envío gratis", 1),
});

export type ShippingSettingsInput = z.output<typeof shippingSettingsSchema>;
export type ShippingSettingsField = keyof z.input<typeof shippingSettingsSchema>;

/** A site path ("/envios", "/search?onSale=1") or an https URL. */
export function isAnnouncementLink(value: string): boolean {
  if (value.startsWith("/")) return !value.startsWith("//") && !/[\s\\]/.test(value);
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/** Whether a partly invalid object still has these fields as the types the rule reads (a boolean flag, strings). */
function fieldsAre(value: unknown, keys: string[]): boolean {
  if (typeof value !== "object" || value === null) return false;
  return keys.every((key) => ["string", "boolean"].includes(typeof (value as Record<string, unknown>)[key]));
}

export const announcementSettingsSchema = z
  .object({
    announcementActive: z.boolean(),
    announcementText: z.string().trim().max(MAX_ANNOUNCEMENT, `Como máximo ${MAX_ANNOUNCEMENT} caracteres`),
    announcementLinkUrl: z
      .string()
      .trim()
      .max(300, "Como máximo 300 caracteres")
      .refine((value) => value === "" || isAnnouncementLink(value), "Una ruta del sitio (/envios) o una URL que empiece con https://"),
    announcementLinkLabel: z.string().trim().max(40, "Como máximo 40 caracteres"),
    announcementTone: z.enum(ANNOUNCEMENT_TONES, { message: "Elige un color" }),
  })
  // Cross-field rules run even when another field failed (`when`), so every error shows at once.
  .refine((value) => !value.announcementActive || Boolean(value.announcementText), {
    path: ["announcementText"],
    message: "Escribe el anuncio o desactiva la barra",
    when: (payload) => fieldsAre(payload.value, ["announcementActive", "announcementText"]),
  })
  .refine((value) => !value.announcementLinkUrl || Boolean(value.announcementLinkLabel), {
    path: ["announcementLinkLabel"],
    message: "Escribe el texto del enlace",
    when: (payload) => fieldsAre(payload.value, ["announcementLinkUrl", "announcementLinkLabel"]),
  });

export type AnnouncementSettingsInput = z.output<typeof announcementSettingsSchema>;
export type AnnouncementSettingsField = keyof z.input<typeof announcementSettingsSchema>;

const socialUrl = z
  .string()
  .trim()
  .max(300, "Como máximo 300 caracteres")
  .refine((value) => {
    if (value === "") return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Una URL que empiece con https://");

export const contactSettingsSchema = z.object({
  contactEmail: z.string().trim().min(1, "Completa el email").max(254, "Como máximo 254 caracteres").pipe(z.email("Ingresa un email válido")),
  contactPhone: z
    .string()
    .trim()
    .min(1, "Completa el teléfono")
    .max(40, "Como máximo 40 caracteres")
    .regex(/^\+?[\d\s()-]{6,}$/, "Solo números, espacios, guiones y un + al principio"),
  contactAddress: z.string().trim().min(1, "Completa la ubicación").max(120, "Como máximo 120 caracteres"),
  contactHours: z.string().trim().min(1, "Completa el horario").max(120, "Como máximo 120 caracteres"),
  socialFacebook: socialUrl,
  socialInstagram: socialUrl,
  socialYoutube: socialUrl,
  socialX: socialUrl,
});

export type ContactSettingsInput = z.output<typeof contactSettingsSchema>;
export type ContactSettingsField = keyof z.input<typeof contactSettingsSchema>;

/** The home page's "Destacados": products in order, no repeats. */
export const featuredSettingsSchema = z.object({
  productIds: z
    .array(z.string().trim().min(1).max(64))
    .max(MAX_FEATURED, `Como máximo ${MAX_FEATURED} productos`)
    .refine((ids) => new Set(ids).size === ids.length, "Hay un producto repetido"),
});

export type FeaturedSettingsInput = z.output<typeof featuredSettingsSchema>;
