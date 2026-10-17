import "server-only";

import NextAuth, { CredentialsSignin, type DefaultSession, type NextAuthConfig, type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Role } from "@/generated/prisma/enums";
import { getDb } from "@/lib/db";
import { clientIp } from "@/lib/rate-limit/client-ip";
import { loginSchema } from "@/lib/validations/auth";
import { verifyCredentials } from "./accounts";
import { prismaAuthAdapter } from "./adapter";
import { refreshSessionToken, type SessionRenewal } from "./session-token";

/*
 * Auth.js (next-auth v5) configuration.
 *
 * Sessions are JWTs in an HttpOnly cookie, not database sessions:
 * - the Credentials provider (email + password) only supports JWT sessions;
 * - reading the session costs no query, which matters because the navbar
 *   reads it on every page;
 * - what JWTs lack, instant revocation, is covered on the server: the token
 *   carries the account's sessionVersion, and getCurrentUser() (session.ts)
 *   checks it and the current role against the database on every protected
 *   page and action. Changing the password bumps the version, so every other
 *   session stops counting, and a refresh never moves a token to a newer
 *   version on its own (session-token.ts).
 *
 * Google sign-in is optional: the provider (and its button) exists only when
 * AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are both set.
 */

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
    /** The account's session version when this token was issued. */
    sessionVersion: number;
  }
  interface User {
    role?: Role;
    sessionVersion?: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: Role;
    /** sessionVersion at issue time. */
    sv?: number;
  }
}

/** Login refused by the rate limiter (the login action shows its own message for it). */
export class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * False without AUTH_SECRET: Auth.js then fails closed (every page renders
 * signed out and no one can log in), and /login and /register say why.
 */
export function isAuthConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.AUTH_SECRET?.trim());
}

export function isGoogleEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.AUTH_GOOGLE_ID?.trim() && env.AUTH_GOOGLE_SECRET?.trim());
}

const credentials = Credentials({
  credentials: { email: {}, password: {} },
  async authorize(input, request) {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) return null;
    const result = await verifyCredentials(parsed.data.email, parsed.data.password, clientIp(request.headers));
    if (result.ok) return result.user;
    if (result.reason === "rate_limited") throw new RateLimitedSignin();
    return null;
  },
});

export const authConfig = {
  adapter: prismaAuthAdapter(getDb),
  providers: [credentials, ...(isGoogleEnabled() ? [Google] : [])],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    signIn({ account, profile }) {
      // The role is granted by email (ADMIN_EMAIL): only addresses Google has verified count.
      if (account?.provider === "google") return profile?.email_verified === true;
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.sub = user.id;
        token.role = user.role ?? "USER";
        token.sv = user.sessionVersion ?? 0;
      }
      // unstable_update() after a profile or password change, but also any client that POSTs
      // /api/auth/session: reload what the token repeats from the database. A stale token
      // stays dead unless the server renewed it (session-token.ts).
      if (trigger === "update") return refreshSessionToken(token, session);
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.role = token.role ?? "USER";
      session.sessionVersion = token.sv ?? 0;
      return session;
    },
  },
  logger: {
    // A wrong password is an expected outcome, not a server error worth a stack trace.
    error(error) {
      const type = (error as { type?: string }).type;
      if (type === "CredentialsSignin") return;
      console.error(`[auth] ${error.name}: ${error.message}`, (error as { cause?: unknown }).cause ?? "");
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth(authConfig);

/**
 * Re-issues this request's session token after a password change bumped the
 * account's session version, so this device stays signed in. `renewal` comes
 * from sessionRenewal() (session-token.ts), made on the server.
 */
export async function renewSession(renewal: SessionRenewal): Promise<void> {
  // unstable_update() is typed for session fields; the jwt callback reads `renewal` from its data.
  await updateSession({ renewal } as Partial<Session>);
}
