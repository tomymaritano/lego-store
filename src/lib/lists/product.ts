import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/*
 * What the cart (./cart.ts) and the wishlist (./wishlist.ts) share: the
 * client they take first (the app's, a test's, or a transaction's) and the
 * product fields every line or item is read with (current data, never a
 * snapshot).
 */

export type Db = PrismaClient | Prisma.TransactionClient;

export const listProductSelect = { id: true, name: true, price: true, img: true, stock: true } as const;

export type ListProduct = Prisma.ProductGetPayload<{ select: typeof listProductSelect }>;
