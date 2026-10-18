import { NextResponse, type NextRequest } from "next/server";
import { authorizeRequest } from "@/lib/auth/session";
import { auditActorFor } from "@/lib/admin/actor";
import { exportCustomers, exportMessages, exportNewsletter, exportOrders, type CsvExport, type ExportKind } from "@/lib/admin/exports";
import { getDb } from "@/lib/db";
import { parseOrderFilters, type SearchParams } from "@/lib/validations/admin";
import { parseMessageFilters, parseSubscriberFilters } from "@/lib/validations/inbox";
import { parseUserFilters } from "@/lib/validations/users";

/*
 * GET /api/admin/export/<orders|customers|newsletter|messages>?<the list's filters>:
 * a CSV download (UTF-8 with BOM, ";", CSV-injection safe: src/lib/admin/csv.ts)
 * streamed from the database. Admins only (401/403 as JSON); every export is
 * recorded in the audit log with its filters and row count. A plain link
 * (GET) so the browser downloads it; it changes nothing but the audit log.
 */

export const dynamic = "force-dynamic";

const KINDS = ["orders", "customers", "newsletter", "messages"] as const satisfies readonly ExportKind[];

export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const auth = await authorizeRequest({ admin: true });
  if ("response" in auth) return auth.response;
  const { kind } = await params;
  if (!(KINDS as readonly string[]).includes(kind)) return NextResponse.json({ error: "No existe esa exportación." }, { status: 404 });

  const search: SearchParams = {};
  for (const [key, value] of request.nextUrl.searchParams) search[key] = value;
  const db = getDb();
  const actor = auditActorFor(auth.user, request.headers);
  const exports: Record<(typeof KINDS)[number], () => Promise<CsvExport>> = {
    orders: () => exportOrders(db, actor, parseOrderFilters(search)),
    customers: () => exportCustomers(db, actor, parseUserFilters(search)),
    newsletter: () => exportNewsletter(db, actor, parseSubscriberFilters(search)),
    messages: () => exportMessages(db, actor, parseMessageFilters(search)),
  };
  const result = await exports[kind as (typeof KINDS)[number]]();

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
