/**
 * `npm run db:seed` (prisma db seed). Seeds the database in DATABASE_URL; see
 * prisma/seed/index.ts for what it writes and why it is safe to re-run, and
 * prisma/seed/admin.ts for how ADMIN_EMAIL / ADMIN_PASSWORD pick the admin.
 */
import { loadEnv } from "./env";
import { createPrismaClient } from "@/lib/db/client";
import { seedDatabase } from "./seed/index";
import { resolveAdmin } from "./seed/admin";

async function main() {
  loadEnv();
  const { admin, notice } = resolveAdmin(process.env);
  if (notice) console.warn(notice);
  const db = createPrismaClient();
  try {
    await seedDatabase(db, { admin, log: (message) => console.log(message) });
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
