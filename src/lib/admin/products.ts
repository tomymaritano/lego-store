import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { escapeLike, productSearchColumns, tokenize } from "@/lib/api/search";
import type { Db } from "@/lib/lists/product";
import { ADMIN_PAGE_SIZE, type AdminProductFilters, type ProductField, type ProductInput } from "@/lib/validations/admin";
import { LOW_STOCK, pageCount, type Page } from "./format";

/*
 * The admin's product catalogue, client first like the rest of the server
 * code (the Server Actions in ./actions.ts pass the app's client, the
 * integration tests their own). No permission checks here: ./data.ts and
 * ./actions.ts check the admin before calling these.
 *
 * The catalogue cache (src/lib/api/cache.ts) is the caller's job: every
 * write returns what it touched so the action can expire those tags.
 *
 * Removing a product: a product that orders reference (OrderItem.productId)
 * is archived, never deleted, so the order keeps its link and the reports
 * their product; one nobody bought is deleted for real. Archiving takes it
 * off the store (src/lib/api/catalog.ts LISTED), and out of every cart and
 * wishlist; restoring puts it back on sale (carts and wishlists stay without it).
 */

export interface AdminProductRow {
  id: string;
  name: string;
  img: string;
  price: number;
  originalPrice: number | null;
  isNew: boolean;
  isOnSale: boolean;
  stock: number;
  categoryId: string;
  categoryName: string;
  rating: number;
  reviewCount: number;
  archived: boolean;
}

const rowSelect = {
  id: true,
  name: true,
  img: true,
  price: true,
  originalPrice: true,
  isNew: true,
  isOnSale: true,
  stock: true,
  categoryId: true,
  rating: true,
  reviewCount: true,
  archivedAt: true,
  category: { select: { name: true } },
} as const satisfies Prisma.ProductSelect;

type Row = Prisma.ProductGetPayload<{ select: typeof rowSelect }>;

const toRow = ({ category, archivedAt, ...row }: Row): AdminProductRow => ({
  ...row,
  categoryName: category.name,
  archived: archivedAt !== null,
});

function productWhere(filters: AdminProductFilters): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];
  if (filters.status === "active") and.push({ archivedAt: null });
  if (filters.status === "archived") and.push({ archivedAt: { not: null } });
  if (filters.category) and.push({ categoryId: filters.category });
  if (filters.stock === "out") and.push({ stock: 0 });
  // Low includes sold out, as the dashboard's "Stock bajo" counts and lists them.
  if (filters.stock === "low") and.push({ stock: { lte: LOW_STOCK } });
  const terms = tokenize(filters.q);
  if (terms.length > 0) {
    // The storefront's search (name, theme, category, description), or the exact id.
    and.push({ OR: [{ AND: terms.map((term) => ({ searchText: { contains: escapeLike(term) } })) }, { id: filters.q.trim() }] });
  }
  return { AND: and };
}

/** One page of products, newest first. */
export async function listAdminProducts(db: Db, filters: AdminProductFilters): Promise<Page<AdminProductRow>> {
  const where = productWhere(filters);
  const total = await db.product.count({ where });
  const totalPages = pageCount(total);
  const page = Math.min(filters.page, totalPages);
  const rows = await db.product.findMany({
    where,
    select: rowSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
  });
  return { items: rows.map(toRow), total, page, totalPages };
}

/** Products in stock at or under LOW_STOCK (sold out included), lowest first: the dashboard's list. */
export async function lowStockProducts(db: Db, take = 8): Promise<AdminProductRow[]> {
  const rows = await db.product.findMany({
    where: { archivedAt: null, stock: { lte: LOW_STOCK } },
    select: rowSelect,
    orderBy: [{ stock: "asc" }, { name: "asc" }],
    take,
  });
  return rows.map(toRow);
}

/** Everything the edit form shows, plus how many order lines reference the product. */
export async function getAdminProduct(db: Db, id: string) {
  const product = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      price: true,
      originalPrice: true,
      isNew: true,
      isOnSale: true,
      categoryId: true,
      type: true,
      age: true,
      theme: true,
      interests: true,
      pieces: true,
      highlight: true,
      img: true,
      imageSecondary: true,
      images: true,
      stock: true,
      shortDescription: true,
      description: true,
      rating: true,
      reviewCount: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { orderItems: true } },
    },
  });
  if (!product) return null;
  const { _count, archivedAt, createdAt, updatedAt, ...rest } = product;
  return {
    ...rest,
    archivedAt: archivedAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    orderLines: _count.orderItems,
  };
}

export type AdminProduct = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;

/** Every category, in the store's order (the list's filter, the form's select). */
export function adminCategories(db: Db): Promise<{ id: string; name: string }[]> {
  return db.category.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }], select: { id: true, name: true } });
}

/** The categories plus the values already in use, offered as suggestions in the form (datalists). */
export async function productFormOptions(db: Db) {
  const [categories, rows] = await Promise.all([
    adminCategories(db),
    db.product.findMany({ select: { type: true, age: true, theme: true, pieces: true, highlight: true, interests: true } }),
  ]);
  const distinct = (values: string[]) => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "es"));
  return {
    categories,
    suggestions: {
      type: distinct(rows.map((row) => row.type)),
      age: distinct(rows.map((row) => row.age)),
      theme: distinct(rows.map((row) => row.theme)),
      pieces: distinct(rows.map((row) => row.pieces)),
      highlight: distinct(rows.map((row) => row.highlight)),
      interests: distinct(rows.flatMap((row) => row.interests)),
    },
  };
}

export type ProductFormOptions = Awaited<ReturnType<typeof productFormOptions>>;

export type ProductWriteResult =
  | { ok: true; productId: string }
  /** The stock moved (a sale, a refund, another admin) since the form loaded `stockSeen`: nothing was saved. */
  | { ok: false; reason: "stock_changed"; stock: number }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid"; fieldErrors: Partial<Record<ProductField, string>> };

async function productData(db: Db, input: ProductInput) {
  const category = await db.category.findUnique({ where: { id: input.categoryId }, select: { id: true, name: true } });
  if (!category) return null;
  return {
    name: input.name,
    price: input.price,
    originalPrice: input.originalPrice,
    isNew: input.isNew,
    isOnSale: input.isOnSale,
    categoryId: category.id,
    type: input.type,
    age: input.age,
    theme: input.theme,
    interests: input.interests,
    pieces: input.pieces,
    highlight: input.highlight,
    img: input.img,
    imageSecondary: input.imageSecondary,
    images: input.images,
    shortDescription: input.shortDescription,
    description: input.description,
    // What the storefront search matches (src/lib/api/search.ts): recomputed on every write.
    ...productSearchColumns({
      name: input.name,
      theme: input.theme,
      categoryId: category.id,
      categoryName: category.name,
      description: input.description,
    }),
  } satisfies Prisma.ProductUncheckedUpdateInput;
}

const NO_CATEGORY = { ok: false, reason: "invalid", fieldErrors: { categoryId: "Esa categoría no existe" } } as const;

/** A new product, on sale right away (rating 0 until someone reviews it). */
export async function createProduct(db: Db, input: ProductInput): Promise<ProductWriteResult> {
  const data = await productData(db, input);
  if (!data) return NO_CATEGORY;
  const product = await db.product.create({ data: { ...data, stock: input.stock }, select: { id: true } });
  return { ok: true, productId: product.id };
}

/**
 * Stock is only ever moved by conditional writes (design doc): a purchase
 * takes units with `stock >= n`, a refund adds them back. The admin sets an
 * absolute number they typed over the one they saw (`seen`), so the write
 * only lands while the stock is still that number; if a sale or a restock
 * happened in between, nothing is written and the caller gets the current
 * stock to show (never silently undoing the sale).
 */
export type StockWriteResult = { ok: true } | { ok: false; reason: "not_found" } | { ok: false; reason: "stock_changed"; stock: number };

async function compareAndSetStock(db: Db, id: string, seen: number, stock: number): Promise<StockWriteResult> {
  const { count } = await db.product.updateMany({ where: { id, stock: seen }, data: { stock } });
  if (count === 1) return { ok: true };
  const current = await db.product.findUnique({ where: { id }, select: { stock: true } });
  return current ? { ok: false, reason: "stock_changed", stock: current.stock } : { ok: false, reason: "not_found" };
}

/**
 * Rewrites every field of the form (rating, reviews and archive state are not
 * form fields). The stock only when the admin changed it from `stockSeen`, the
 * value the form loaded, and only if it is still that (compareAndSetStock):
 * otherwise nothing is saved.
 */
export async function updateProduct(db: PrismaClient, id: string, input: ProductInput, stockSeen: number): Promise<ProductWriteResult> {
  return db.$transaction(async (tx): Promise<ProductWriteResult> => {
    const data = await productData(tx, input);
    if (!data) return NO_CATEGORY;
    const { count } = await tx.product.updateMany({ where: { id }, data });
    if (count !== 1) return { ok: false, reason: "not_found" };
    if (input.stock !== stockSeen) {
      const stock = await compareAndSetStock(tx, id, stockSeen, input.stock);
      if (!stock.ok) throw new StockChanged(stock.reason === "stock_changed" ? stock.stock : null);
    }
    return { ok: true, productId: id };
  }).catch((error: unknown): ProductWriteResult => {
    if (!(error instanceof StockChanged)) throw error;
    return error.stock === null ? { ok: false, reason: "not_found" } : { ok: false, reason: "stock_changed", stock: error.stock };
  });
}

/** Rolls back the rest of the edit when the stock compare-and-set fails. */
class StockChanged extends Error {
  constructor(readonly stock: number | null) {
    super("stock_changed");
  }
}

/** Sets the stock (quick edit) from `seen`, the value the admin saw, if it still is that one. */
export function setProductStock(db: Db, id: string, seen: number, stock: number): Promise<StockWriteResult> {
  return compareAndSetStock(db, id, seen, stock);
}

/**
 * Takes the product off the store: archived (and out of every cart and
 * wishlist). Archiving it twice changes nothing. False for an unknown product.
 */
export function archiveProduct(db: PrismaClient, id: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id }, select: { archivedAt: true } });
    if (!product) return false;
    if (product.archivedAt === null) await tx.product.update({ where: { id }, data: { archivedAt: new Date() } });
    await tx.cartItem.deleteMany({ where: { productId: id } });
    await tx.wishlistItem.deleteMany({ where: { productId: id } });
    return true;
  });
}

/** Puts an archived product back on the store. False for an unknown product. */
export async function restoreProduct(db: Db, id: string): Promise<boolean> {
  const { count } = await db.product.updateMany({ where: { id }, data: { archivedAt: null } });
  return count === 1;
}

export type RemoveProductResult = { result: "deleted" } | { result: "archived"; orderLines: number } | { result: "not_found" };

/**
 * "Eliminar": deletes the product (its cart and wishlist lines, reviews and
 * votes go with it) when no order references it; otherwise archives it, so
 * the orders keep pointing at it. The product row is locked first, so a
 * checkout cannot add an order line in between.
 */
export function removeProduct(db: PrismaClient, id: string): Promise<RemoveProductResult> {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Product" WHERE "id" = ${id} FOR UPDATE`;
    if (locked.length === 0) return { result: "not_found" } as const;
    const orderLines = await tx.orderItem.count({ where: { productId: id } });
    if (orderLines > 0) {
      await tx.product.updateMany({ where: { id, archivedAt: null }, data: { archivedAt: new Date() } });
      await tx.cartItem.deleteMany({ where: { productId: id } });
      await tx.wishlistItem.deleteMany({ where: { productId: id } });
      return { result: "archived", orderLines } as const;
    }
    await tx.product.delete({ where: { id } });
    return { result: "deleted" } as const;
  });
}
