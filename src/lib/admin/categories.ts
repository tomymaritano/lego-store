import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { Db } from "@/lib/lists/product";
import type { CategoryInput } from "@/lib/validations/catalog";
import { diffFields, recordAudit, snapshotFields, type AuditActor, type AuditEntryView } from "./audit";
import { moveInOrder, nextPosition, refreshSearchColumns, type Direction } from "./catalog-order";

/*
 * The admin's categories (/admin/categories): everything the storefront
 * shows of them (name, description, image and its alt text), their order,
 * whether they are visible, and their slug. Client first; no permission
 * checks here (./data.ts and ./actions.ts). Every write records its audit
 * entry in the same transaction; the caller expires the catalogue cache.
 *
 * The slug is Category.id, the /category/<slug> URL and every product's
 * categoryId. Changing it updates the products in the same statement (ON
 * UPDATE CASCADE) and keeps the old slug as a CategoryRedirect: old links
 * and bookmarks get a permanent redirect (src/proxy.ts), and the category's
 * audit trail is found under every slug it had. A slug that is another
 * category's, or another category's old one, is refused.
 *
 * Deleting is only for a category no product uses (archived ones count:
 * their orders still show them); otherwise hide it.
 */

export interface AdminCategoryRow {
  id: string;
  name: string;
  description: string;
  image: string;
  imageAlt: string;
  visible: boolean;
  position: number;
  /** Products on sale in it / all its products (archived ones too). */
  listed: number;
  products: number;
  /** Its previous slugs (they redirect here). */
  redirects: string[];
}

const rowSelect = {
  id: true,
  name: true,
  description: true,
  image: true,
  imageAlt: true,
  visible: true,
  position: true,
  redirects: { select: { slug: true }, orderBy: { createdAt: "desc" } },
} as const satisfies Prisma.CategorySelect;

type Row = Prisma.CategoryGetPayload<{ select: typeof rowSelect }>;

async function withCounts(db: Db, rows: Row[]): Promise<AdminCategoryRow[]> {
  const ids = rows.map((row) => row.id);
  const [all, listed] = await Promise.all([
    db.product.groupBy({ by: ["categoryId"], where: { categoryId: { in: ids } }, _count: { _all: true } }),
    db.product.groupBy({ by: ["categoryId"], where: { categoryId: { in: ids }, archivedAt: null }, _count: { _all: true } }),
  ]);
  const count = (groups: typeof all, id: string) => groups.find((group) => group.categoryId === id)?._count._all ?? 0;
  return rows.map(({ redirects, ...row }) => ({
    ...row,
    products: count(all, row.id),
    listed: count(listed, row.id),
    redirects: redirects.map((redirect) => redirect.slug),
  }));
}

/** Every category in the store's order, hidden ones included. */
export async function listAdminCategories(db: Db): Promise<AdminCategoryRow[]> {
  const rows = await db.category.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }], select: rowSelect });
  return withCounts(db, rows);
}

export interface AdminCategoryDetail extends AdminCategoryRow {
  history: AuditEntryView[];
}

/** One category with its audit trail (under its current and its previous slugs). */
export async function getAdminCategory(db: Db, id: string): Promise<AdminCategoryDetail | null> {
  const row = await db.category.findUnique({ where: { id }, select: rowSelect });
  if (!row) return null;
  const [category] = await withCounts(db, [row]);
  const slugs = [row.id, ...row.redirects.map((redirect) => redirect.slug)];
  const history = await db.auditLog.findMany({
    where: { entityType: "category", entityId: { in: slugs } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    select: { id: true, action: true, actorId: true, actorEmail: true, entityType: true, entityId: true, changes: true, ip: true, createdAt: true },
  });
  return {
    ...category!,
    history: history.map(({ createdAt, changes, ...entry }) => ({ ...entry, changes: (changes as AuditEntryView["changes"]) ?? null, at: createdAt.toISOString() })),
  };
}

export type CategoryWriteResult =
  | { ok: true; categoryId: string; changed: boolean; productIds: string[] }
  | { ok: false; reason: "not_found" }
  /** Another category has that slug. */
  | { ok: false; reason: "slug_taken" }
  /** Another category had that slug before (it redirects there). */
  | { ok: false; reason: "slug_redirect"; categoryId: string };

type Tx = Prisma.TransactionClient;

/** Whether `slug` is free for `self` (null: a new category): no other category has it now or had it. */
async function slugConflict(tx: Tx, slug: string, self: string | null): Promise<CategoryWriteResult | null> {
  const [current, redirect] = await Promise.all([
    tx.category.findUnique({ where: { id: slug }, select: { id: true } }),
    tx.categoryRedirect.findUnique({ where: { slug }, select: { categoryId: true } }),
  ]);
  if (current && current.id !== self) return { ok: false, reason: "slug_taken" };
  if (redirect && redirect.categoryId !== self) return { ok: false, reason: "slug_redirect", categoryId: redirect.categoryId };
  return null;
}

const columnsOf = (input: CategoryInput) => ({
  name: input.name,
  description: input.description,
  image: input.image,
  imageAlt: input.imageAlt,
  visible: input.visible,
});

const isUniqueViolation = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** A new category, last in the order. */
export async function createCategory(db: PrismaClient, actor: AuditActor, input: CategoryInput): Promise<CategoryWriteResult> {
  try {
    return await db.$transaction(async (tx): Promise<CategoryWriteResult> => {
      const conflict = await slugConflict(tx, input.slug, null);
      if (conflict) return conflict;
      const position = await nextPosition(tx, "Category");
      await tx.category.create({ data: { id: input.slug, ...columnsOf(input), position } });
      await recordAudit(tx, actor, {
        action: "category.create",
        entityType: "category",
        entityId: input.slug,
        changes: snapshotFields({ slug: input.slug, ...columnsOf(input), position }),
      });
      return { ok: true, categoryId: input.slug, changed: true, productIds: [] };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "slug_taken" };
    throw error;
  }
}

/**
 * Saves the form. A new slug renames the row (its products follow) and keeps
 * the old one as a redirect; going back to an earlier slug of the same
 * category drops that redirect. A changed name or slug recomputes its
 * products' search columns (`productIds`, for the caller's cache).
 */
export async function updateCategory(db: PrismaClient, actor: AuditActor, id: string, input: CategoryInput): Promise<CategoryWriteResult> {
  try {
    return await db.$transaction(async (tx): Promise<CategoryWriteResult> => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Category" WHERE "id" = ${id} FOR UPDATE`;
      if (locked.length === 0) return { ok: false, reason: "not_found" };
      const before = await tx.category.findUniqueOrThrow({ where: { id }, select: { id: true, name: true, description: true, image: true, imageAlt: true, visible: true } });
      const after = columnsOf(input);
      const changes = diffFields({ slug: before.id, ...before }, { slug: input.slug, ...after });
      if (Object.keys(changes).length === 0) return { ok: true, categoryId: id, changed: false, productIds: [] };

      if (input.slug !== id) {
        const conflict = await slugConflict(tx, input.slug, id);
        if (conflict) return conflict;
        // Back to one of its own earlier slugs: that redirect would now point at itself.
        await tx.categoryRedirect.deleteMany({ where: { slug: input.slug } });
        await tx.category.update({ where: { id }, data: { id: input.slug, ...after } });
        await tx.categoryRedirect.create({ data: { slug: id, categoryId: input.slug } });
      } else {
        await tx.category.update({ where: { id }, data: after });
      }
      const productIds = "name" in changes || "slug" in changes ? await refreshSearchColumns(tx, { categoryId: input.slug }) : [];
      await recordAudit(tx, actor, { action: "category.update", entityType: "category", entityId: input.slug, changes });
      return { ok: true, categoryId: input.slug, changed: true, productIds };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "slug_taken" };
    throw error;
  }
}

export type MoveResult = { ok: true; moved: boolean } | { ok: false; reason: "not_found" };

/** "Subir" / "Bajar": one place in the navigation's order. */
export function moveCategory(db: PrismaClient, actor: AuditActor, id: string, direction: Direction): Promise<MoveResult> {
  return db.$transaction(async (tx): Promise<MoveResult> => {
    const result = await moveInOrder(tx, "Category", id, direction);
    if (!result) return { ok: false, reason: "not_found" };
    if (result.moved) {
      await recordAudit(tx, actor, { action: "category.reorder", entityType: "category", entityId: id, changes: { position: [result.from + 1, result.to + 1] } });
    }
    return { ok: true, moved: result.moved };
  });
}

export type DeleteResult = { ok: true } | { ok: false; reason: "not_found" } | { ok: false; reason: "in_use"; products: number };

/** Deletes a category no product uses (archived products count). Its redirects go with it. */
export function deleteCategory(db: PrismaClient, actor: AuditActor, id: string): Promise<DeleteResult> {
  return db.$transaction(async (tx): Promise<DeleteResult> => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Category" WHERE "id" = ${id} FOR UPDATE`;
    if (locked.length === 0) return { ok: false, reason: "not_found" };
    const products = await tx.product.count({ where: { categoryId: id } });
    if (products > 0) return { ok: false, reason: "in_use", products };
    const before = await tx.category.findUniqueOrThrow({ where: { id }, select: { id: true, name: true, description: true, image: true, imageAlt: true, visible: true, position: true } });
    await tx.category.delete({ where: { id } });
    const { id: slug, ...rest } = before;
    await recordAudit(tx, actor, { action: "category.delete", entityType: "category", entityId: id, changes: snapshotFields({ slug, ...rest }) });
    return { ok: true };
  });
}
