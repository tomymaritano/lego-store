import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { normalizeText } from "@/lib/api/search";
import type { Db } from "@/lib/lists/product";
import type { ThemeInput } from "@/lib/validations/catalog";
import { diffFields, listAuditEntries, recordAudit, snapshotFields, type AuditActor, type AuditEntryView } from "./audit";
import { moveInOrder, nextPosition, refreshSearchColumns, type Direction } from "./catalog-order";
import type { DeleteResult, MoveResult } from "./categories";

/*
 * The admin's themes (/admin/themes): the product cards' label, the "Temas"
 * menu (visible ones, in order) and the theme filter. Client first; no
 * permission checks here (./data.ts and ./actions.ts). Every write records
 * its audit entry in the same transaction; the caller expires the cache.
 *
 * Names are unique ignoring case and accents ("star wars" is "Star Wars"),
 * since the filter matches them that way; slugs are unique too (the filter
 * takes them as well: ?theme=star-wars). Renaming recomputes its products'
 * search columns. A theme any product uses (archived ones too) is not
 * deleted: hide it instead.
 */

export interface AdminThemeRow {
  id: string;
  name: string;
  slug: string;
  visible: boolean;
  position: number;
  listed: number;
  products: number;
}

const rowSelect = { id: true, name: true, slug: true, visible: true, position: true } as const satisfies Prisma.ThemeSelect;

/** Every theme in the store's order, hidden ones included, with how many products use it. */
export async function listAdminThemes(db: Db): Promise<AdminThemeRow[]> {
  const [rows, all, listed] = await Promise.all([
    db.theme.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }], select: rowSelect }),
    db.product.groupBy({ by: ["themeId"], _count: { _all: true } }),
    db.product.groupBy({ by: ["themeId"], where: { archivedAt: null }, _count: { _all: true } }),
  ]);
  const count = (groups: typeof all, id: string) => groups.find((group) => group.themeId === id)?._count._all ?? 0;
  return rows.map((row) => ({ ...row, products: count(all, row.id), listed: count(listed, row.id) }));
}

export interface AdminThemeDetail extends AdminThemeRow {
  history: AuditEntryView[];
}

export async function getAdminTheme(db: Db, id: string): Promise<AdminThemeDetail | null> {
  const rows = await listAdminThemes(db);
  const theme = rows.find((row) => row.id === id);
  if (!theme) return null;
  return { ...theme, history: await listAuditEntries(db, "theme", id) };
}

export type ThemeWriteResult =
  | { ok: true; themeId: string; changed: boolean; productIds: string[] }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "name_taken" | "slug_taken" };

type Tx = Prisma.TransactionClient;

/** Another theme with the same name (ignoring case and accents) or slug. */
async function conflict(tx: Tx, input: ThemeInput, self: string | null): Promise<ThemeWriteResult | null> {
  const others = await tx.theme.findMany({ where: self ? { id: { not: self } } : undefined, select: { name: true, slug: true } });
  if (others.some((theme) => normalizeText(theme.name) === normalizeText(input.name))) return { ok: false, reason: "name_taken" };
  if (others.some((theme) => theme.slug === input.slug)) return { ok: false, reason: "slug_taken" };
  return null;
}

const isUniqueViolation = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** Theme writes lock the table's rows (as a move does): two admins cannot create the same name at once. */
const lockThemes = (tx: Tx) => tx.$queryRaw`SELECT "id" FROM "Theme" ORDER BY "position", "id" FOR UPDATE`;

/** A new theme, last in the order. */
export async function createTheme(db: PrismaClient, actor: AuditActor, input: ThemeInput): Promise<ThemeWriteResult> {
  try {
    return await db.$transaction(async (tx): Promise<ThemeWriteResult> => {
      await lockThemes(tx);
      const taken = await conflict(tx, input, null);
      if (taken) return taken;
      const position = await nextPosition(tx, "Theme");
      const theme = await tx.theme.create({ data: { name: input.name, slug: input.slug, visible: input.visible, position }, select: { id: true } });
      await recordAudit(tx, actor, { action: "theme.create", entityType: "theme", entityId: theme.id, changes: snapshotFields({ ...input, position }) });
      return { ok: true, themeId: theme.id, changed: true, productIds: [] };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "name_taken" };
    throw error;
  }
}

/** Saves the form; a rename recomputes its products' search columns (`productIds`, for the caller's cache). */
export async function updateTheme(db: PrismaClient, actor: AuditActor, id: string, input: ThemeInput): Promise<ThemeWriteResult> {
  try {
    return await db.$transaction(async (tx): Promise<ThemeWriteResult> => {
      await lockThemes(tx);
      const before = await tx.theme.findUnique({ where: { id }, select: { name: true, slug: true, visible: true } });
      if (!before) return { ok: false, reason: "not_found" };
      const changes = diffFields(before, input);
      if (Object.keys(changes).length === 0) return { ok: true, themeId: id, changed: false, productIds: [] };
      const taken = await conflict(tx, input, id);
      if (taken) return taken;
      await tx.theme.update({ where: { id }, data: input });
      const productIds = "name" in changes ? await refreshSearchColumns(tx, { themeId: id }) : [];
      await recordAudit(tx, actor, { action: "theme.update", entityType: "theme", entityId: id, changes });
      return { ok: true, themeId: id, changed: true, productIds };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "name_taken" };
    throw error;
  }
}

/** "Subir" / "Bajar": one place in the menu's order. */
export function moveTheme(db: PrismaClient, actor: AuditActor, id: string, direction: Direction): Promise<MoveResult> {
  return db.$transaction(async (tx): Promise<MoveResult> => {
    const result = await moveInOrder(tx, "Theme", id, direction);
    if (!result) return { ok: false, reason: "not_found" };
    if (result.moved) {
      await recordAudit(tx, actor, { action: "theme.reorder", entityType: "theme", entityId: id, changes: { position: [result.from + 1, result.to + 1] } });
    }
    return { ok: true, moved: result.moved };
  });
}

/** Deletes a theme no product uses (archived products count). */
export function deleteTheme(db: PrismaClient, actor: AuditActor, id: string): Promise<DeleteResult> {
  return db.$transaction(async (tx): Promise<DeleteResult> => {
    await lockThemes(tx);
    const theme = await tx.theme.findUnique({ where: { id }, select: { name: true, slug: true, visible: true, position: true } });
    if (!theme) return { ok: false, reason: "not_found" };
    const products = await tx.product.count({ where: { themeId: id } });
    if (products > 0) return { ok: false, reason: "in_use", products };
    await tx.theme.delete({ where: { id } });
    await recordAudit(tx, actor, { action: "theme.delete", entityType: "theme", entityId: id, changes: snapshotFields(theme) });
    return { ok: true };
  });
}
