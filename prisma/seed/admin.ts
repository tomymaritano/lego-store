/**
 * Which admin user `npm run db:seed` writes, from ADMIN_EMAIL / ADMIN_PASSWORD.
 *
 * - Both set: that account (created, or promoted to ADMIN with that password).
 * - Only one set: an error. Mixing a real email with the public dev password
 *   would hand out an admin account anyone can log into.
 * - Neither set (empty counts as unset, as in a copied .env.example): the
 *   documented dev admin, only with the explicit opt-in SEED_DEV_ADMIN=1 and
 *   never with NODE_ENV=production. Without the opt-in no admin is created.
 *   The host of DATABASE_URL is not a signal: a production Postgres can sit on
 *   localhost too.
 *
 * Whenever the seed writes another admin (or none), it also demotes the dev
 * admin if an earlier run created it (see seedDatabase).
 */

export const DEV_ADMIN = { email: "admin@lego-store.local", password: "admin-dev-1234" } as const;

export type AdminCredentials = { email: string; password: string };

type Env = { ADMIN_EMAIL?: string; ADMIN_PASSWORD?: string; SEED_DEV_ADMIN?: string; NODE_ENV?: string; [key: string]: string | undefined };

const present = (value: string | undefined) => (value && value.trim() ? value : undefined);

export function resolveAdmin(env: Env): { admin: AdminCredentials | null; notice?: string } {
  const email = present(env.ADMIN_EMAIL)?.trim();
  const password = present(env.ADMIN_PASSWORD);

  if (email && password) return { admin: { email, password } };
  if (email || password) {
    throw new Error(
      `Falta ${email ? "ADMIN_PASSWORD" : "ADMIN_EMAIL"}: ADMIN_EMAIL y ADMIN_PASSWORD se definen juntas o ninguna.`
    );
  }
  if (env.NODE_ENV === "production") {
    return {
      admin: null,
      notice:
        "ADMIN_EMAIL / ADMIN_PASSWORD no están definidas y NODE_ENV=production: no se crea el usuario admin (el admin de desarrollo nunca se crea en producción).",
    };
  }
  if (env.SEED_DEV_ADMIN === "1") {
    return {
      admin: { ...DEV_ADMIN },
      notice: `SEED_DEV_ADMIN=1: se usa el admin de desarrollo (${DEV_ADMIN.email} / ${DEV_ADMIN.password}). Solo para tu máquina.`,
    };
  }
  return {
    admin: null,
    notice:
      "ADMIN_EMAIL / ADMIN_PASSWORD no están definidas: no se crea el usuario admin. En desarrollo, SEED_DEV_ADMIN=1 crea el admin de desarrollo.",
  };
}
