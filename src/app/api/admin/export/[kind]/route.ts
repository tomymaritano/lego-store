import { NextResponse, type NextRequest } from "next/server";
import { authorizeRequest } from "@/lib/auth/session";
import { auditActorFor } from "@/lib/admin/actor";
import { exportCustomers, exportNewsletter, exportOrders, type CsvExport } from "@/lib/admin/exports";
import { getDb } from "@/lib/db";
import { parseOrderFilters, type SearchParams } from "@/lib/validations/admin";
import { parseSubscriberFilters } from "@/lib/validations/inbox";
import { parseUserFilters } from "@/lib/validations/users";

/*
 * GET /api/admin/export/<orders|customers|newsletter>?<the list's filters>:
 * a CSV download (UTF-8 with BOM, ";", CSV-injection safe: src/lib/admin/csv.ts)
 * streamed from the database. Admins only (401/403 as JSON); every export is
 * recorded in the audit log with its filters and row count. A plain link
 * (GET) so the browser downloads it; it changes nothing but the audit log.
 */

export const dynamic = "force-dynamic";

const KINDS = ["orders", "customers", "newsletter"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const auth = await authorizeRequest({ admin: true });
  if ("response" in auth) return auth.response;
  const { kind } = await params;
  if (!(KINDS as readonly string[]).includes(kind)) return NextResponse.json({ error: "No existe esa exportación." }, { status: 404 });

  const search: SearchParams = {};
  for (const [key, value] of request.nextUrl.searchParams) search[key] = value;
  const db = getDb();
  const actor = auditActorFor(auth.user, request.headers);
  const result: CsvExport =
    kind === "orders"
      ? await exportOrders(db, actor, parseOrderFilters(search))
      : kind === "customers"
        ? await exportCustomers(db, actor, parseUserFilters(search))
        : await exportNewsletter(db, actor, parseSubscriberFilters(search));

  return new Response(result.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Export-Rows": String(result.rows),
    },
  });
}
