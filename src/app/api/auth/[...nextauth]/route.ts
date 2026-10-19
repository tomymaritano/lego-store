import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { getAccountUser } from "@/lib/auth/accounts";

// Auth.js endpoints: OAuth redirects and callbacks, session, CSRF, sign-out.
export const { POST } = handlers;

/**
 * GET as Auth.js answers it, except GET /api/auth/session: a JWT stays
 * signed until it expires, so Auth.js alone would keep describing an account
 * an admin blocked, or a session another device revoked (a password change,
 * "cerrar todas las sesiones"), as signed in. The server already refuses
 * those (getCurrentUser); here the client is told the same: `null`, as
 * for no session, and no refreshed cookie.
 */
export async function GET(request: NextRequest) {
  const response = await handlers.GET(request);
  if (!request.nextUrl.pathname.endsWith("/session") || !response.ok) return response;

  const session = (await response.clone().json().catch(() => null)) as { user?: { id?: string }; sessionVersion?: number } | null;
  const id = session?.user?.id;
  if (!id) return response;
  const user = await getAccountUser(id);
  if (user && !user.blocked && user.sessionVersion === session.sessionVersion) return response;
  return Response.json(null, { headers: { "Cache-Control": "private, no-cache, no-store" } });
}
