import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";
import type { PrismaClient } from "@/generated/prisma/client";
import { normalizeEmail, roleForEmail } from "./email";

/*
 * Auth.js adapter on our Prisma client, for OAuth sign-ins (Google): finding
 * the user behind a provider account, creating one on first sign-in, linking
 * the account. Sessions are JWTs and there is no email provider, so the
 * session and verification-token methods are left out.
 *
 * Written here instead of @auth/prisma-adapter so that every write follows
 * the app's rules: emails normalised (the CHECK on User.email rejects
 * anything else), ADMIN_EMAIL gets the ADMIN role, and Auth.js only ever sees
 * the columns it knows about (never passwordHash).
 */

const userSelect = { id: true, name: true, email: true, emailVerified: true, image: true, role: true, sessionVersion: true } as const;

export function prismaAuthAdapter(db: () => PrismaClient): Adapter {
  return {
    async createUser({ name, email, emailVerified, image }: AdapterUser) {
      const normalized = normalizeEmail(email);
      return db().user.create({
        data: { name: name ?? null, email: normalized, emailVerified, image: image ?? null, role: roleForEmail(normalized) },
        select: userSelect,
      });
    },

    getUser(id) {
      return db().user.findUnique({ where: { id }, select: userSelect });
    },

    getUserByEmail(email) {
      return db().user.findUnique({ where: { email: normalizeEmail(email) }, select: userSelect });
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const account = await db().account.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        select: { user: { select: userSelect } },
      });
      return account?.user ?? null;
    },

    updateUser({ id, name, email, emailVerified, image }) {
      return db().user.update({
        where: { id },
        // Only what Auth.js may change; role and password are the app's business.
        data: {
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email: normalizeEmail(email) }),
          ...(emailVerified !== undefined && { emailVerified }),
          ...(image !== undefined && { image }),
        },
        select: userSelect,
      });
    },

    async deleteUser(id) {
      await db().user.delete({ where: { id } });
    },

    async linkAccount(account: AdapterAccount) {
      await db().account.create({
        data: {
          userId: account.userId,
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          refresh_token: account.refresh_token ?? null,
          access_token: account.access_token ?? null,
          expires_at: account.expires_at ?? null,
          token_type: account.token_type ?? null,
          scope: account.scope ?? null,
          id_token: account.id_token ?? null,
          session_state: typeof account.session_state === "string" ? account.session_state : null,
        },
      });
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await db().account.delete({ where: { provider_providerAccountId: { provider, providerAccountId } } });
    },
  };
}
