import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * A Prisma client on the node-postgres driver adapter (Prisma 7 has no
 * built-in engine connection). The app uses the shared instance in
 * ./index.ts; the seed and the integration tests make their own with this.
 */
export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL no está definida. Levanta Postgres con `npm run db:up` y copia .env.example a .env.local (ver README, «Inicio rápido»)."
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export type { PrismaClient };
