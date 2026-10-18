/*
 * What an admin may upload as a picture (src/lib/uploads/index.ts), decided
 * from the file's own bytes, never from its name or the browser's
 * Content-Type: JPEG, PNG, WebP and AVIF only. SVG (scriptable), GIF, HEIC
 * and everything else are refused. Client-safe (the uploader checks the
 * size and kind before sending, to answer at once; the server checks again).
 */

export type ImageKind = "jpeg" | "png" | "webp" | "avif";

/** Largest file accepted, in bytes. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Largest picture (in pixels) decoded: a small file can expand into a huge bitmap. */
export const MAX_UPLOAD_PIXELS = 40_000_000;

/** What the file picker offers (a hint only: the bytes decide). */
export const UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

export const UPLOAD_KIND_LABEL = "JPG, PNG, WebP o AVIF";

export const CONTENT_TYPES: Record<ImageKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export const EXTENSIONS: Record<ImageKind, string> = { jpeg: "jpg", png: "png", webp: "webp", avif: "avif" };

const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));

/** AVIF is an ISO-BMFF file whose `ftyp` box names avif/avis as its major or a compatible brand. */
function isAvif(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || ascii(bytes, 4, 4) !== "ftyp") return false;
  const boxSize = ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
  const end = Math.min(bytes.length, boxSize >= 16 ? boxSize : 16, 64);
  const brands = [ascii(bytes, 8, 4)];
  for (let offset = 16; offset + 4 <= end; offset += 4) brands.push(ascii(bytes, offset, 4));
  return brands.some((brand) => brand === "avif" || brand === "avis");
}

/** The picture's format from its first bytes, or null for anything that is not one we accept. */
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)) return "png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  if (isAvif(bytes)) return "avif";
  return null;
}

export type UploadRejection = "empty" | "too_large" | "unsupported" | "unreadable" | "too_many_pixels";

export const UPLOAD_ERRORS: Record<UploadRejection, string> = {
  empty: "El archivo está vacío.",
  too_large: `La imagen pesa más de ${MAX_UPLOAD_BYTES / 1024 / 1024} MB. Achícala o expórtala con más compresión.`,
  unsupported: `Ese archivo no es una imagen ${UPLOAD_KIND_LABEL}. Las imágenes SVG, GIF o HEIC no se aceptan.`,
  unreadable: "No pudimos leer la imagen: el archivo parece dañado.",
  too_many_pixels: "La imagen es demasiado grande (más de 40 megapíxeles). Achícala antes de subirla.",
};

/** The checks that only need the bytes: size and format. */
export function checkUpload(bytes: Uint8Array): { ok: true; kind: ImageKind } | { ok: false; reason: UploadRejection } {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };
  const kind = detectImageKind(bytes);
  return kind ? { ok: true, kind } : { ok: false, reason: "unsupported" };
}

/** A stored upload's file name: random hex, an optional "-<width>" variant, the extension. */
export const UPLOAD_NAME_PATTERN = /^[a-f0-9]{32}\.(?:webp|jpg|png|avif)$/;
