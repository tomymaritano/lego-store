import "server-only";

import { cache } from "react";
import { forbidden, redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma/enums";
import { getAccountUser } from "./accounts";
import { loginHref } from "./callback-url";
import { auth } from "./index";

/*
 * Who is signed in, checked against the database. This is the authorisation
 * layer: proxy.ts only redirects visitors without a session cookie early, and
 * every protected page, Server Action and Route Handler calls one of these
 * (proxy matchers can miss a route; these cannot).
 *
 * A session counts only while its user still exists and its token carries the
 * account's current sessionVersion (a password change ends every other
 * session). The role always comes from the database, never from the token, so
 * a demoted admin loses access on the next request.
 */

export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  /** False for accounts that only sign in with Google. */
  hasPassword: boolean;
}

/** The signed-in user, or null. One session read and one query per request (cached for the render). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await getAccountUser(id);
  if (!user || user.sessionVersion !== session.sessionVersion) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, hasPassword: user.hasPassword };
});

interface RequireOptions {
  /** Where to come back to after logging in (the current page). */
  callbackUrl?: string;
}

/** The signed-in user; without one, redirects to /login and back to `callbackUrl` afterwards. */
export async function requireUser({ callbackUrl = "/account" }: RequireOptions = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginHref(callbackUrl));
  return user;
}

/** An admin; signed-out visitors go to /login, signed-in non-admins get the 403 page. */
export async function requireAdmin({ callbackUrl = "/admin" }: RequireOptions = {}): Promise<CurrentUser> {
  const user = await requireUser({ callbackUrl });
  if (user.role !== "ADMIN") forbidden();
  return user;
}

/**
 * For Route Handlers: the user, or the JSON response to return instead
 * (401 without a session, 403 for a non-admin when `admin` is set).
 *
 *   const auth = await authorizeRequest({ admin: true });
 *   if ("response" in auth) return auth.response;
 */
export async function authorizeRequest({ admin = false }: { admin?: boolean } = {}): Promise<
  { user: CurrentUser } | { response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ error: "Tienes que iniciar sesión." }, { status: 401 }) };
  if (admin && user.role !== "ADMIN") {
    return { response: NextResponse.json({ error: "No tienes permiso para hacer esto." }, { status: 403 }) };
  }
  return { user };
}
