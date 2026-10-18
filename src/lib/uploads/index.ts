import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { recordAudit, type AuditActor } from "@/lib/admin/audit";
import { processImage } from "./process";
import { uploadStorage, type UploadStorage } from "./storage";
import { checkUpload, UPLOAD_ERRORS, type UploadRejection } from "./validate";

/*
 * An admin's picture upload (POST /api/admin/uploads): checked by its bytes
 * (./validate.ts), re-encoded to WebP when sharp is there
 * (./process.ts), stored under a random name (./storage.ts: Vercel Blob or
 * the local disk) and recorded in the audit log. What is returned is the
 * URL the forms put in the product's gallery or the category's image; the
 * storefront serves it through next/image like any other picture.
 *
 * Nothing deletes uploads: a product edit may still be using one, and old
 * orders keep their image snapshots.
 */

export type SaveUploadResult =
  | { ok: true; url: string; width: number | null; height: number | null; bytes: number }
  | { ok: false; reason: UploadRejection | "unconfigured"; message: string };

export const UPLOADS_UNCONFIGURED = "Las subidas no están configuradas en este servidor (falta BLOB_READ_WRITE_TOKEN). Usa una URL.";

interface SaveOptions {
  /** The admin uploading it (the audit entry). */
  actor: AuditActor;
  /** Where to store it (defaults to this server's: uploadStorage()). */
  storage?: UploadStorage | null;
  /** False skips sharp (tests of the fallback). */
  useSharp?: boolean;
}

export async function saveUpload(db: PrismaClient, bytes: Uint8Array, { actor, storage = uploadStorage(), useSharp = true }: SaveOptions): Promise<SaveUploadResult> {
  const checked = checkUpload(bytes);
  if (!checked.ok) return { ok: false, reason: checked.reason, message: UPLOAD_ERRORS[checked.reason] };
  if (!storage) return { ok: false, reason: "unconfigured", message: UPLOADS_UNCONFIGURED };

  const processed = await processImage(bytes, checked.kind, { useSharp });
  if (!processed.ok) return { ok: false, reason: processed.reason, message: UPLOAD_ERRORS[processed.reason] };

  const id = randomBytes(16).toString("hex");
  const { file } = processed;
  const url = await storage.put(`${id}.${file.extension}`, file.bytes, file.contentType);
  const size = file.bytes.length;
  await recordAudit(db, actor, {
    action: "upload.create",
    entityType: "upload",
    entityId: id,
    changes: { url, bytes: size, width: processed.width, height: processed.height, original: checked.kind, storage: storage.kind },
  });
  return { ok: true, url, width: processed.width, height: processed.height, bytes: size };
}
