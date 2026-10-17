/**
 * `npm run db:seed` (prisma db seed). Seeds the database in DATABASE_URL; see
 * prisma/seed/index.ts for what it writes and why it is safe to re-run.
 *
 * Admin user: ADMIN_EMAIL / ADMIN_PASSWORD. Outside production, missing values
 * fall back to the documented dev defaults below; in production they are
 * required (the admin is skipped with a warning when they are not set).
 */
import { loadEnv } from "./env";
import { createPrismaClient } from "@/lib/db/client";
import { seedDatabase } from "./seed/index";

export const DEV_ADMIN = { email: "admin@lego-store.local", password: "admin-dev-1234" } as const;

function adminFromEnv(): { email: string; password: string } | null {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) return { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };
  if (process.env.NODE_ENV === "production") {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD no están definidas: no se crea el usuario admin.");
    return null;
  }
  console.warn(`ADMIN_EMAIL / ADMIN_PASSWORD no están definidas: se usa el admin de desarrollo (${DEV_ADMIN.email}).`);
  return { email: ADMIN_EMAIL ?? DEV_ADMIN.email, password: ADMIN_PASSWORD ?? DEV_ADMIN.password };
}

async function main() {
  loadEnv();
  const db = createPrismaClient();
  try {
    await seedDatabase(db, { admin: adminFromEnv(), log: (message) => console.log(message) });
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
