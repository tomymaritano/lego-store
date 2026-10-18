import { siteConfig } from "@/config/site";
import { formatPrice } from "@/lib/utils";
import type { StoreSettings } from "./defaults";

/*
 * Placeholders an admin can write in the announcement bar and the info
 * pages' content ("Envío gratis desde {{envio_gratis_desde}}"), filled with
 * the store's current settings when the text is shown. A figure the admin
 * changes in /admin/configuracion (the shipping cost) then changes
 * everywhere it is written, instead of going stale in a page's text.
 *
 * Only these names are replaced; anything else between braces stays as it
 * is. The values are plain text (never markup).
 */

export interface Placeholder {
  key: string;
  /** What the admin's help lists. */
  label: string;
  value: (settings: StoreSettings) => string;
}

export const PLACEHOLDERS: readonly Placeholder[] = [
  { key: "costo_envio", label: "Costo del envío", value: (s) => formatPrice(s.shipping.cost) },
  { key: "envio_gratis_desde", label: "Envío gratis desde", value: (s) => formatPrice(s.shipping.freeFrom) },
  { key: "dias_devolucion", label: "Días para devolver", value: () => String(siteConfig.commerce.returnDays) },
  { key: "dias_entrega_min", label: "Días de entrega (mínimo)", value: () => String(siteConfig.commerce.deliveryDays.min) },
  { key: "dias_entrega_max", label: "Días de entrega (máximo)", value: () => String(siteConfig.commerce.deliveryDays.max) },
  { key: "tienda", label: "Nombre de la tienda", value: () => siteConfig.name },
  { key: "email", label: "Email de contacto", value: (s) => s.contact.email },
  { key: "telefono", label: "Teléfono", value: (s) => s.contact.phone },
  { key: "horario", label: "Horario de atención", value: (s) => s.contact.hours },
];

const BY_KEY = new Map(PLACEHOLDERS.map((placeholder) => [placeholder.key, placeholder]));

/** `text` with every known {{placeholder}} replaced by its value. */
export function fillPlaceholders(text: string, settings: StoreSettings): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) => BY_KEY.get(key)?.value(settings) ?? match);
}
