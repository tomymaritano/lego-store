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

async function requestIp(): Promise<string | null> {
  try {
    const ip = clientIp(await headers());
    return ip === "unknown" ? null : ip;
  } catch {
    // Outside a request (scripts, tests): no IP to record.
    return null;
  }
}

export async function requireAdminActor(options: { callbackUrl?: string } = {}): Promise<AdminActor> {
  const admin = await requireAdmin(options);
  return { ...admin, ip: await requestIp() };
}
