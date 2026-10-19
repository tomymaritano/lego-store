import { NextResponse, type NextRequest } from "next/server";
import { authorizeRequest } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { auditActorFor } from "@/lib/admin/actor";
import { rateLimits, waitMessage } from "@/lib/rate-limit";
import { readBodyCapped } from "@/lib/request-body";
import { saveUpload } from "@/lib/uploads";
import { MAX_UPLOAD_BYTES, UPLOAD_ERRORS } from "@/lib/uploads/validate";

/*
 * POST /api/admin/uploads (multipart/form-data, one `file`): an admin's
 * picture for a product gallery or a category. Admins only (401/403 as
 * JSON), same-origin only, rate limited per admin. Answers { url,
 * width, height } or { error } with the reason in words.
 * A Route Handler rather than a Server Action: the browser can report the
 * upload's progress (XMLHttpRequest), and actions cap bodies at 1 MB.
 */

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE });

/** Multipart framing on top of the file itself. */
const MULTIPART_SLACK = 64 * 1024;
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + MULTIPART_SLACK;

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host = new URL(origin).host;
    return host === request.nextUrl.host || host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizeRequest({ admin: true });
  if ("response" in auth) return auth.response;
  // Browsers send Origin on every POST: a form on another site cannot upload as the admin.
  if (!sameOrigin(request)) return fail("Origen no permitido.", 403);

  // A declared size over the cap is refused unread; an undeclared one (chunked) is counted as it arrives.
  const length = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(length) || length > MAX_BODY_BYTES) return fail(UPLOAD_ERRORS.too_large, 413);

  const limit = await rateLimits.adminUpload.consume(`user:${auth.user.id}`);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Subiste demasiadas imágenes seguidas. Espera ${waitMessage(limit.retryAfterSeconds)} y vuelve a intentarlo.` },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let file: FormDataEntryValue | null;
  try {
    const body = await readBodyCapped(request, MAX_BODY_BYTES);
    if (!body) return fail(UPLOAD_ERRORS.too_large, 413);
    const contentType = request.headers.get("content-type") ?? "";
    file = (await new Response(body, { headers: { "content-type": contentType } }).formData()).get("file");
  } catch {
    return fail("No recibimos ninguna imagen.", 400);
  }
  if (!file || typeof file === "string") return fail("No recibimos ninguna imagen.", 400);
  if (file.size > MAX_UPLOAD_BYTES) return fail(UPLOAD_ERRORS.too_large, 413);

  const result = await saveUpload(getDb(), new Uint8Array(await file.arrayBuffer()), {
    actor: auditActorFor(auth.user, request.headers),
  });
  if (!result.ok) return fail(result.message, result.reason === "unconfigured" ? 503 : result.reason === "too_large" ? 413 : 422);
  return NextResponse.json(
    { url: result.url, width: result.width, height: result.height },
    { status: 201, headers: NO_STORE }
  );
}
