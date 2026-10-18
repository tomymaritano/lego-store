import "server-only";

import { headers } from "next/headers";
import { requireAdmin, type CurrentUser } from "@/lib/auth/session";
import { clientIp } from "@/lib/rate-limit/client-ip";
import type { AuditActor } from "./audit";

/*
 * Who is making an admin change, as its audit entry records it: the admin
 * (requireAdmin: a signed-out caller is sent to log in, a customer gets the
 * 403) plus the request's IP. The IP is only the one client-ip.ts trusts
 * (Vercel's, or the outermost trusted proxy's); without either it is null
 * rather than whatever the client claimed.
 */

export type AdminActor = CurrentUser & AuditActor;

/** The IP an audit entry records for a request with these headers (null when none is trusted). */
function auditIp(source: Headers): string | null {
  const ip = clientIp(source);
  return ip === "unknown" ? null : ip;
}

/** The audit actor for an admin a Route Handler already authorised (authorizeRequest), from its request's headers. */
export function auditActorFor(user: { id: string; email: string }, source: Headers): AuditActor {
  return { id: user.id, email: user.email, ip: auditIp(source) };
}

async function requestIp(): Promise<string | null> {
  try {
    return auditIp(await headers());
  } catch {
    // Outside a request (scripts, tests): no IP to record.
    return null;
  }
}

export async function requireAdminActor(options: { callbackUrl?: string } = {}): Promise<AdminActor> {
  const admin = await requireAdmin(options);
  return { ...admin, ip: await requestIp() };
}
