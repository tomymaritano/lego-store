import "server-only";

import type { StoreSettings as StoreSettingsRow } from "@/generated/prisma/client";
import { CATALOG_TAGS, cached } from "@/lib/api/cache";
import { getDb } from "@/lib/db";
import type { Db } from "@/lib/lists/product";
import type { ShippingRules } from "@/lib/pricing";
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from "./defaults";

/*
 * Server reads of the store's settings (the StoreSettings row, id 1).
 *
 * - getStoreSettings(): what pages show (announcement bar, footer, contact
 *   page, the cart's shipping copy), through the data cache under the
 *   "settings" tag; an admin's save expires it (updateSettingsCache).
 * - readShippingRules(db): what the server prices an order with, straight
 *   from the database (or the caller's transaction), never from the cache:
 *   the amount charged must follow the setting the moment it changes.
 *
 * Without the row (a database nobody seeded yet) both fall back to
 * DEFAULT_STORE_SETTINGS.
 */

export const SETTINGS_ID = 1;

export function settingsFromRow(row: StoreSettingsRow | null): StoreSettings {
  if (!row) return DEFAULT_STORE_SETTINGS;
  return {
    shipping: { cost: row.shippingCost, freeFrom: row.freeShippingFrom },
    announcement: {
      active: row.announcementActive,
      text: row.announcementText,
      linkUrl: row.announcementLinkUrl,
      linkLabel: row.announcementLinkLabel,
      tone: row.announcementTone,
    },
    contact: { email: row.contactEmail, phone: row.contactPhone, address: row.contactAddress, hours: row.contactHours },
    social: { facebook: row.socialFacebook, instagram: row.socialInstagram, youtube: row.socialYoutube, x: row.socialX },
  };
}

/** The settings as they are in the database now (uncached). */
export async function readStoreSettings(db: Db): Promise<StoreSettings> {
  return settingsFromRow(await db.storeSettings.findUnique({ where: { id: SETTINGS_ID } }));
}

/** The shipping rule an order is priced with (uncached: the database's current value). */
export async function readShippingRules(db: Db): Promise<ShippingRules> {
  const row = await db.storeSettings.findUnique({ where: { id: SETTINGS_ID }, select: { shippingCost: true, freeShippingFrom: true } });
  return row ? { cost: row.shippingCost, freeFrom: row.freeShippingFrom } : DEFAULT_STORE_SETTINGS.shipping;
}

/** The settings for pages (data cache, tag "settings"). */
export const getStoreSettings: () => Promise<StoreSettings> = cached(
  "getStoreSettings",
  () => readStoreSettings(getDb()),
  () => [CATALOG_TAGS.settings]
);
