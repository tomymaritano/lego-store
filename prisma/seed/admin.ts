/**
 * Which admin user `npm run db:seed` writes, from ADMIN_EMAIL / ADMIN_PASSWORD.
 *
 * - Both set: that account (created, or promoted to ADMIN with that password).
 * - Only one set: an error. Mixing a real email with the public dev password
 *   would hand out an admin account anyone can log into.
 * - Neither set (empty counts as unset, as in a copied .env.example): the
 *   documented dev admin, but only for a database on this machine (DATABASE_URL
 *   on localhost) or with SEED_DEV_ADMIN=1; anywhere else no admin is created.
 *
 * NODE_ENV is deliberately not consulted: `prisma db seed` does not set it.
 */

export const DEV_ADMIN = { email: "admin@lego-store.local", password: "admin-dev-1234" } as const;

export type AdminCredentials = { email: string; password: string };

type Env = { ADMIN_EMAIL?: string; ADMIN_PASSWORD?: string; SEED_DEV_ADMIN?: string; DATABASE_URL?: string; [key: string]: string | undefined };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** True when the connection string points at a Postgres on this machine. */
export function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

const present = (value: string | undefined) => (value && value.trim() ? value : undefined);

export function resolveAdmin(env: Env): { admin: AdminCredentials | null; notice?: string } {
  const email = present(env.ADMIN_EMAIL)?.trim();
  const password = present(env.ADMIN_PASSWORD);

  if (email && password) return { admin: { email, password } };
  if (email || password) {
    throw new Error(
      `Falta ${email ? "ADMIN_PASSWORD" : "ADMIN_EMAIL"}: ADMIN_EMAIL y ADMIN_PASSWORD se definen juntas o ninguna (sin ninguna, en local se usa el admin de desarrollo).`
    );
  }
  if (env.SEED_DEV_ADMIN === "1" || isLocalDatabase(env.DATABASE_URL)) {
    return {
      admin: { ...DEV_ADMIN },
      notice: `ADMIN_EMAIL / ADMIN_PASSWORD no están definidas: se usa el admin de desarrollo (${DEV_ADMIN.email} / ${DEV_ADMIN.password}).`,
    };
  }
  return {
    admin: null,
    notice:
      "ADMIN_EMAIL / ADMIN_PASSWORD no están definidas y la base no es local: no se crea el usuario admin (SEED_DEV_ADMIN=1 fuerza el admin de desarrollo).",
  };
}
