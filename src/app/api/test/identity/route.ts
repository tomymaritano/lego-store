import { isMockAllowed } from "@/lib/payments/config";
import { serverIdentity } from "@/lib/server-identity";

/**
 * GET /api/test/identity: which checkout and database this dev server runs
 * with (a hash, src/lib/server-identity.ts), so the e2e global setup reuses
 * only its own server. PAYMENTS_MOCK=1 only, like the other /api/test routes:
 * a 404 anywhere else, and always in a production build.
 */
export const dynamic = "force-dynamic";

export function GET() {
  if (!isMockAllowed()) return new Response(null, { status: 404 });
  return Response.json({ identity: serverIdentity(process.cwd(), process.env.DATABASE_URL) }, { headers: { "Cache-Control": "no-store" } });
}
