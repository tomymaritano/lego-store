import { afterAll } from "vitest";
import { createPrismaClient } from "@/lib/db/client";
import { seedDatabase, type SeedOptions } from "../../../prisma/seed/index";
import { testDatabaseUrl } from "../../../prisma/test-database";

/** A client of its own on the test database (lib/api uses the app's shared one, also on it). */
export const testDb = createPrismaClient(testDatabaseUrl());

afterAll(async () => {
  await testDb.$disconnect();
});

/** Empties every table (keeps the migrations table), so a test starts from nothing. */
export async function resetDatabase(): Promise<void> {
  const tables = await testDb.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await testDb.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Empty database + the seed (no admin unless asked: bcrypt is slow on purpose). */
export async function resetAndSeed(options: Partial<SeedOptions> = {}) {
  await resetDatabase();
  return seedDatabase(testDb, { admin: null, ...options });
}
