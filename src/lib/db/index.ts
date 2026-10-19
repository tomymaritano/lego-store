import "server-only";

import { createPrismaClient, type PrismaClient } from "./client";

/*
 * The app's single Prisma client. Kept on globalThis in development so hot
 * reloads reuse one connection pool instead of opening a new one per edit.
 * Created on first use, so importing this module never needs a database.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDb(): PrismaClient {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}

export type { PrismaClient };
