import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { CartLineInput } from "@/lib/validations/lists";
import type { CartItem } from "@/types";

/*
 * A signed-in user's cart in the database (CartItem rows). Every function
 * takes the client first (like lib/api/catalog.ts), so the Server Actions use
 * the app's client and the integration tests their own.
 *
 * The server is the truth:
 * - lines are returned with the product's current name, price, picture and
 *   stock (never a snapshot), and their quantity capped by that stock;
 * - every write caps the quantity by the stock at that moment, in the same
 *   statement or transaction (quantity > 0 is also a database check);
 * - a product that is out of stock cannot be added; a line whose product sold
 *   out stays stored but is not listed (it comes back if it is restocked) and
 *   checkout never sees it.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export type CartWriteResult =
  | { ok: true; line: CartItem }
  | { ok: false; reason: "not_found" | "out_of_stock" };

const lineSelect = {
  quantity: true,
  product: { select: { id: true, name: true, price: true, img: true, stock: true } },
} as const;

type LineRow = { quantity: number; product: { id: string; name: string; price: number; img: string; stock: number } };

function toCartItem({ quantity, product }: LineRow): CartItem {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    image: product.img,
    stock: product.stock,
    quantity: Math.min(quantity, product.stock),
  };
}

/** The user's cart, oldest line first, with current product data; sold-out lines are left out. */
export async function getCart(db: Db, userId: string): Promise<CartItem[]> {
  const rows = await db.cartItem.findMany({
    where: { userId, product: { stock: { gt: 0 } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: lineSelect,
  });
  return rows.map(toCartItem);
}

/**
 * Lowers stored quantities above the current stock (for the given products,
 * or the whole cart). Lines of sold-out products are left as they are: the
 * quantity > 0 check forbids 0, and getCart skips them.
 */
async function capToStock(tx: Prisma.TransactionClient, userId: string, productIds: string[] | null) {
  await tx.$executeRaw`
    UPDATE "CartItem" AS c
    SET "quantity" = p."stock", "updatedAt" = now()
    FROM "Product" AS p
    WHERE p."id" = c."productId"
      AND c."userId" = ${userId}
      AND (${productIds}::text[] IS NULL OR c."productId" = ANY(${productIds}::text[]))
      AND p."stock" > 0
      AND c."quantity" > p."stock"
  `;
}

async function readLine(tx: Prisma.TransactionClient, userId: string, productId: string): Promise<CartItem | null> {
  const row = await tx.cartItem.findUnique({ where: { userId_productId: { userId, productId } }, select: lineSelect });
  return row ? toCartItem(row) : null;
}

/** The line after a write; a product that sold out meanwhile (another checkout) reads as out of stock. */
function written(line: CartItem | null): CartWriteResult {
  return line && line.stock > 0 ? { ok: true, line } : { ok: false, reason: "out_of_stock" };
}

async function availability(tx: Prisma.TransactionClient, productId: string) {
  const product = await tx.product.findUnique({ where: { id: productId }, select: { stock: true } });
  if (!product) return "not_found" as const;
  return product.stock > 0 ? ("ok" as const) : ("out_of_stock" as const);
}

/**
 * Adds `quantity` units to the user's line for the product (creating it),
 * capped by the stock. The increment runs in the database, so two tabs
 * adding at once both count.
 */
export function addToCart(db: PrismaClient, userId: string, productId: string, quantity: number): Promise<CartWriteResult> {
  return db.$transaction(async (tx) => {
    const status = await availability(tx, productId);
    if (status !== "ok") return { ok: false, reason: status };
    await tx.cartItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId, quantity },
      update: { quantity: { increment: quantity } },
    });
    await capToStock(tx, userId, [productId]);
    return written(await readLine(tx, userId, productId));
  });
}

/** Sets the line to exactly `quantity` units (creating it), capped by the stock. */
export function setCartQuantity(db: PrismaClient, userId: string, productId: string, quantity: number): Promise<CartWriteResult> {
  return db.$transaction(async (tx) => {
    const status = await availability(tx, productId);
    if (status !== "ok") return { ok: false, reason: status };
    await tx.cartItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId, quantity },
      update: { quantity },
    });
    await capToStock(tx, userId, [productId]);
    return written(await readLine(tx, userId, productId));
  });
}

export async function removeFromCart(db: Db, userId: string, productId: string): Promise<void> {
  await db.cartItem.deleteMany({ where: { userId, productId } });
}

export async function clearCart(db: Db, userId: string): Promise<void> {
  await db.cartItem.deleteMany({ where: { userId } });
}

/** Repeated products in one request count once, with their quantities added up. */
function combine(lines: CartLineInput[]): CartLineInput[] {
  const totals = new Map<string, number>();
  for (const { productId, quantity } of lines) totals.set(productId, (totals.get(productId) ?? 0) + quantity);
  return Array.from(totals, ([productId, quantity]) => ({ productId, quantity }));
}

/**
 * Merges a guest cart into the user's (on login): quantities of the same
 * product are added up and capped by the stock; products that no longer
 * exist or are sold out are skipped. One transaction. Returns the merged cart.
 */
export function mergeCart(db: PrismaClient, userId: string, lines: CartLineInput[]): Promise<CartItem[]> {
  return db.$transaction(async (tx) => {
    const wanted = combine(lines);
    if (wanted.length > 0) {
      const available = await tx.product.findMany({
        where: { id: { in: wanted.map((line) => line.productId) }, stock: { gt: 0 } },
        select: { id: true },
      });
      const ids = new Set(available.map((product) => product.id));
      // Explicit, increasing timestamps: new lines keep the guest cart's order, after the saved ones.
      const start = Date.now();
      for (const [index, { productId, quantity }] of wanted.entries()) {
        if (!ids.has(productId)) continue;
        await tx.cartItem.upsert({
          where: { userId_productId: { userId, productId } },
          create: { userId, productId, quantity, createdAt: new Date(start + index) },
          update: { quantity: { increment: quantity } },
        });
      }
      await capToStock(tx, userId, Array.from(ids));
    }
    return getCart(tx, userId);
  });
}
