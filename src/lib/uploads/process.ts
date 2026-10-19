import { CONTENT_TYPES, EXTENSIONS, MAX_UPLOAD_PIXELS, type ImageKind, type UploadRejection } from "./validate";

/*
 * Re-encoding an accepted upload before it is stored. With sharp (Next's own
 * image library, a dependency here) every picture is decoded and written
 * again as WebP: whatever else the file carried (EXIF with the location,
 * trailing bytes, a polyglot payload) is dropped, and EXIF rotation is
 * applied, at most MAX_EDGE on its longer side. One file only: next/image
 * already serves smaller sizes wherever the picture is shown, so a stored
 * thumbnail would be work and storage nothing uses. Without sharp (a platform it does
 * not install on) the original bytes are kept as they are, already checked
 * by their magic bytes.
 */

export const MAX_EDGE = 1600;
const QUALITY = 82;

export interface ProcessedFile {
  extension: string;
  contentType: string;
  bytes: Uint8Array;
}

export type ProcessResult =
  | { ok: true; file: ProcessedFile; width: number | null; height: number | null; reencoded: boolean }
  | { ok: false; reason: Extract<UploadRejection, "unreadable" | "too_many_pixels"> };

type Sharp = (typeof import("sharp"))["default"];

let sharpModule: Promise<Sharp | null> | undefined;

/** sharp, or null where it cannot load. Loaded once. */
function loadSharp(): Promise<Sharp | null> {
  sharpModule ??= import("sharp").then(
    (module) => (module as unknown as { default?: Sharp }).default ?? (module as unknown as Sharp),
    () => null
  );
  return sharpModule;
}

/** sharp's name for each format we accept (AVIF is a HEIF container). */
const SHARP_FORMATS: Record<ImageKind, string[]> = { jpeg: ["jpeg"], png: ["png"], webp: ["webp"], avif: ["heif", "avif"] };

export async function processImage(bytes: Uint8Array, kind: ImageKind, { useSharp = true }: { useSharp?: boolean } = {}): Promise<ProcessResult> {
  const sharp = useSharp ? await loadSharp() : null;
  if (!sharp) {
    return { ok: true, reencoded: false, width: null, height: null, file: { extension: EXTENSIONS[kind], contentType: CONTENT_TYPES[kind], bytes } };
  }
  const input = Buffer.from(bytes);
  try {
    const metadata = await sharp(input, { limitInputPixels: false }).metadata();
    if (!metadata.width || !metadata.height || !SHARP_FORMATS[kind].includes(String(metadata.format))) return { ok: false, reason: "unreadable" };
    if (metadata.width * metadata.height > MAX_UPLOAD_PIXELS) return { ok: false, reason: "too_many_pixels" };
    const { data, info } = await sharp(input, { limitInputPixels: MAX_UPLOAD_PIXELS })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer({ resolveWithObject: true });
    return {
      ok: true,
      reencoded: true,
      width: info.width,
      height: info.height,
      file: { extension: "webp", contentType: "image/webp", bytes: new Uint8Array(data) },
    };
  } catch {
    // Truncated or corrupt data that passed the magic bytes.
    return { ok: false, reason: "unreadable" };
  }
}
