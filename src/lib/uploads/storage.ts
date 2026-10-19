import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/*
 * Where uploaded pictures are kept:
 *
 * - Vercel Blob when BLOB_READ_WRITE_TOKEN is set (production): public
 *   blobs under uploads/, served from <store>.public.blob.vercel-storage.com
 *   (allowed in next.config.mjs images.remotePatterns);
 * - otherwise a folder on this server's disk, public/uploads (gitignored),
 *   served at /uploads/<name> (src/app/uploads/[file]/route.ts serves the
 *   files written after the build started). UPLOADS_DIR moves it (tests).
 *
 * On Vercel without a token there is nowhere to write (its disk is
 * read-only): uploads say they are not configured.
 */

export interface UploadStorage {
  kind: "blob" | "local";
  /** Stores `bytes` as `name` and returns the URL to show it at. */
  put(name: string, bytes: Uint8Array, contentType: string): Promise<string>;
}

/** Uploads keep their random names forever: browsers and the CDN may cache them for a year. */
const CACHE_SECONDS = 365 * 24 * 60 * 60;

export function blobStorage(token: string): UploadStorage {
  return {
    kind: "blob",
    async put(name, bytes, contentType) {
      const { put } = await import("@vercel/blob");
      const blob = await put(`uploads/${name}`, Buffer.from(bytes), {
        access: "public",
        token,
        contentType,
        addRandomSuffix: false,
        cacheControlMaxAge: CACHE_SECONDS,
      });
      return blob.url;
    },
  };
}

/** The folder of local uploads: UPLOADS_DIR, or public/uploads. */
export function localUploadsDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.UPLOADS_DIR?.trim() ? path.resolve(env.UPLOADS_DIR) : path.join(process.cwd(), "public", "uploads");
}

export function diskStorage(dir = localUploadsDir()): UploadStorage {
  return {
    kind: "local",
    async put(name, bytes) {
      await mkdir(dir, { recursive: true });
      // "wx": a name is never written twice (they are random; a clash fails instead of overwriting).
      await writeFile(path.join(dir, name), bytes, { flag: "wx" });
      return `/uploads/${name}`;
    },
  };
}

/** A local upload's bytes (the /uploads route), or null when there is no such file. */
export async function readLocalUpload(name: string, dir = localUploadsDir()): Promise<Buffer | null> {
  try {
    return await readFile(path.join(dir, name));
  } catch {
    return null;
  }
}

/** The storage for this server, or null when uploads cannot be stored here (Vercel without a Blob token). */
export function uploadStorage(env: NodeJS.ProcessEnv = process.env): UploadStorage | null {
  const token = env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) return blobStorage(token);
  if (env.VERCEL === "1") return null;
  return diskStorage(localUploadsDir(env));
}
