import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Db } from "@/lib/lists/product";
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from "@/lib/settings/defaults";
import { SETTINGS_ID, settingsFromRow } from "@/lib/settings";
import type { AnnouncementSettingsInput, ContactSettingsInput, ShippingSettingsInput } from "@/lib/validations/settings";
import { diffFields, listAuditEntries, recordAudit, type AuditActor, type AuditEntryView } from "./audit";

/*
 * The admin's store settings (/admin/configuracion): the StoreSettings row
 * and the home page's featured products. Client first; no permission checks
 * here (./data.ts and ./actions.ts). Every save records its audit entry
 * ("settings.<section>", entity "settings" / "store") in the same
 * transaction; the caller expires the "settings" cache tag.
 */

/** AuditLog.entityId of the settings (there is one row). */
export const SETTINGS_ENTITY_ID = "store";

export type SettingsSection = "shipping" | "announcement" | "contact";

type SectionInput = { shipping: ShippingSettingsInput; announcement: AnnouncementSettingsInput; contact: ContactSettingsInput };

/** The row's columns from the app's settings (what a first save writes for the sections it does not touch). */
function columnsOf(settings: StoreSettings): Omit<Prisma.StoreSettingsCreateInput, "id"> {
  return {
    shippingCost: settings.shipping.cost,
    freeShippingFrom: settings.shipping.freeFrom,
    announcementActive: settings.announcement.active,
    announcementText: settings.announcement.text,
    announcementLinkUrl: settings.announcement.linkUrl,
    announcementLinkLabel: settings.announcement.linkLabel,
    announcementTone: settings.announcement.tone,
    contactEmail: settings.contact.email,
    contactPhone: settings.contact.phone,
    contactAddress: settings.contact.address,
    contactHours: settings.contact.hours,
    socialFacebook: settings.social.facebook,
    socialInstagram: settings.social.instagram,
    socialYoutube: settings.social.youtube,
    socialX: settings.social.x,
  };
}

export interface AdminFeaturedProduct {
  id: string;
  name: string;
  img: string;
  stock: number;
  archived: boolean;
}

export interface AdminSettings {
  settings: StoreSettings;
  /** Whether the row exists (false: the store runs on the defaults until the first save). */
  saved: boolean;
  featured: AdminFeaturedProduct[];
  /** Every product on sale, A-Z, for the featured picker. */
  productOptions: { id: string; name: string; img: string }[];
  history: AuditEntryView[];
}

export async function getAdminSettings(db: Db): Promise<AdminSettings> {
  const [row, featured, products, history] = await Promise.all([
    db.storeSettings.findUnique({ where: { id: SETTINGS_ID } }),
    db.featuredProduct.findMany({
      orderBy: [{ position: "asc" }, { productId: "asc" }],
      select: { product: { select: { id: true, name: true, img: true, stock: true, archivedAt: true } } },
    }),
    db.product.findMany({ where: { archivedAt: null }, orderBy: [{ searchName: "asc" }, { id: "asc" }], select: { id: true, name: true, img: true } }),
    listAuditEntries(db, "settings", SETTINGS_ENTITY_ID, 20),
  ]);
  return {
    settings: settingsFromRow(row),
    saved: row !== null,
    featured: featured.map(({ product }) => ({
      id: product.id,
      name: product.name,
      img: product.img,
      stock: product.stock,
      archived: product.archivedAt !== null,
    })),
    productOptions: products,
    history,
  };
}

/** The section's columns as the form sends them (the input already has the column names). */
const sectionColumns = <S extends SettingsSection>(input: SectionInput[S]): Record<string, unknown> => ({ ...input });

/**
 * Saves one section of the settings (the other columns stay as they are, or
 * get the defaults on the first save). `changed` is false when nothing
 * differed (no entry is written then).
 */
export async function saveSettingsSection<S extends SettingsSection>(
  db: PrismaClient,
  actor: AuditActor,
  section: S,
  input: SectionInput[S]
): Promise<{ changed: boolean }> {
  return db.$transaction(async (tx) => {
    // The row is locked for the read and the write: two admins saving at once write one after the other.
    await tx.$queryRaw`SELECT "id" FROM "StoreSettings" WHERE "id" = ${SETTINGS_ID} FOR UPDATE`;
    const row = await tx.storeSettings.findUnique({ where: { id: SETTINGS_ID } });
    const before = columnsOf(settingsFromRow(row));
    const after = sectionColumns<S>(input);
    const changes = diffFields(before, after);
    if (Object.keys(changes).length === 0) return { changed: false };
    await tx.storeSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...columnsOf(DEFAULT_STORE_SETTINGS), ...before, ...after },
      update: after,
    });
    await recordAudit(tx, actor, { action: `settings.${section}`, entityType: "settings", entityId: SETTINGS_ENTITY_ID, changes });
    return { changed: true };
  });
}

export type FeaturedWriteResult = { ok: true; changed: boolean } | { ok: false; reason: "unknown_product"; productId: string };

/**
 * Replaces the home page's featured products with `productIds`, in that
 * order. Every id must be a product on sale (not archived).
 */
export async function setFeaturedProducts(db: PrismaClient, actor: AuditActor, productIds: string[]): Promise<FeaturedWriteResult> {
  return db.$transaction(async (tx): Promise<FeaturedWriteResult> => {
    await tx.$queryRaw`SELECT "productId" FROM "FeaturedProduct" FOR UPDATE`;
    const listed = await tx.product.findMany({ where: { id: { in: productIds }, archivedAt: null }, select: { id: true } });
    const known = new Set(listed.map((product) => product.id));
    const missing = productIds.find((id) => !known.has(id));
    if (missing) return { ok: false, reason: "unknown_product", productId: missing };

    const before = (await tx.featuredProduct.findMany({ orderBy: [{ position: "asc" }, { productId: "asc" }], select: { productId: true } })).map(
      (row) => row.productId
    );
    const changes = diffFields({ featured: before }, { featured: productIds });
    if (Object.keys(changes).length === 0) return { ok: true, changed: false };
    await tx.featuredProduct.deleteMany({});
    if (productIds.length > 0) await tx.featuredProduct.createMany({ data: productIds.map((productId, position) => ({ productId, position })) });
    await recordAudit(tx, actor, { action: "settings.featured", entityType: "settings", entityId: SETTINGS_ENTITY_ID, changes });
    return { ok: true, changed: true };
  });
}
