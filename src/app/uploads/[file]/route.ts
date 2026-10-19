import { readLocalUpload } from "@/lib/uploads/storage";
import { UPLOAD_NAME_PATTERN } from "@/lib/uploads/validate";

/*
 * GET /uploads/<name>: pictures the admin uploaded to this server's disk
 * (src/lib/uploads/storage.ts, when there is no Vercel Blob token). `next
 * dev` serves new files in public/ by itself; a production server only
 * knows the files public/ had when it started, so the ones uploaded since
 * come through here. Only names the uploader generates are read (random
 * hex, a variant, an image extension): nothing else on the disk is
 * reachable. The names never change, so the response caches for a year.
 */

const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", png: "image/png", avif: "image/avif" };

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!UPLOAD_NAME_PATTERN.test(file)) return new Response("Not found", { status: 404 });
  const bytes = await readLocalUpload(file);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": TYPES[file.split(".").pop()!]!,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
