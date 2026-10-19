import { describe, expect, it } from "vitest";
import { checkUpload, detectImageKind, MAX_UPLOAD_BYTES, UPLOAD_NAME_PATTERN } from "@/lib/uploads/validate";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(values.flatMap((value) => (typeof value === "string" ? Array.from(value, (char) => char.charCodeAt(0)) : [value])));

describe("upload validation by magic bytes", () => {
  it("recognises JPEG, PNG, WebP and AVIF from their first bytes", () => {
    expect(detectImageKind(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe("jpeg");
    expect(detectImageKind(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe("png");
    expect(detectImageKind(bytes("RIFF", 0, 0, 0, 0, "WEBPVP8 "))).toBe("webp");
    expect(detectImageKind(bytes(0, 0, 0, 0x1c, "ftypavif", 0, 0, 0, 0, "mif1miaf"))).toBe("avif");
    // AVIF as a compatible brand of another major brand.
    expect(detectImageKind(bytes(0, 0, 0, 0x1c, "ftypmif1", 0, 0, 0, 0, "avifmiaf"))).toBe("avif");
  });

  it("refuses everything else, whatever the file is called", () => {
    expect(detectImageKind(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(detectImageKind(bytes("<?xml version"))).toBeNull();
    expect(detectImageKind(bytes("GIF89a", 0, 0))).toBeNull();
    // HEIC: an ftyp box without the AVIF brands.
    expect(detectImageKind(bytes(0, 0, 0, 0x18, "ftypheic", 0, 0, 0, 0, "mif1heic"))).toBeNull();
    expect(detectImageKind(bytes("RIFF", 0, 0, 0, 0, "WAVEfmt "))).toBeNull();
    expect(detectImageKind(bytes(0xff, 0xd8))).toBeNull();
    expect(detectImageKind(new Uint8Array())).toBeNull();
  });

  it("checks the size first", () => {
    expect(checkUpload(new Uint8Array())).toEqual({ ok: false, reason: "empty" });
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(checkUpload(big)).toEqual({ ok: false, reason: "too_large" });
    expect(checkUpload(bytes(0xff, 0xd8, 0xff, 0xdb))).toEqual({ ok: true, kind: "jpeg" });
  });

  it("only names the uploader generates are served", () => {
    expect(UPLOAD_NAME_PATTERN.test("0123456789abcdef0123456789abcdef.webp")).toBe(true);
    for (const name of ["0123456789abcdef0123456789abcdef-480.webp", "../.env", "x.webp", "0123456789abcdef0123456789abcdef.svg", "0123456789ABCDEF0123456789ABCDEF.webp", "0123456789abcdef0123456789abcdef.webp/.."]) {
      expect(UPLOAD_NAME_PATTERN.test(name)).toBe(false);
    }
  });
});
