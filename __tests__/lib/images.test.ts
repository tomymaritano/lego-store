import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.mjs";
import { blobPublicHostname } from "@/lib/blob-host.mjs";
import { isAllowedImageUrl, remoteImagePatterns, REMOTE_IMAGE_PATTERNS } from "@/lib/images";

const STORE_BLOB = "abc123xyz.public.blob.vercel-storage.com";
const withBlob = remoteImagePatterns(STORE_BLOB);

describe("product picture URLs", () => {
  it("allows exactly what next.config.mjs lets next/image load", () => {
    // The config hands the app the Blob host it allowed (BLOB_PUBLIC_HOSTNAME), and both build the same list from it.
    const blobHost = nextConfig.env?.BLOB_PUBLIC_HOSTNAME || null;
    expect(nextConfig.images?.remotePatterns).toEqual(remoteImagePatterns(blobHost));
    expect(REMOTE_IMAGE_PATTERNS).toEqual(remoteImagePatterns(process.env.BLOB_PUBLIC_HOSTNAME || null));
    // No localPatterns: Next's default refuses site files with a query string, and so does isAllowedImageUrl.
    expect(nextConfig.images?.localPatterns).toBeUndefined();
  });

  it.each([
    "/images/lego.png",
    "https://www.lego.com/cdn/cs/set/assets/bltde62e4576a817dd4/75349.png",
    "  https://www.lego.com/cdn/x.png  ",
    // Uploads: Vercel Blob in production, site files in dev.
    `https://${STORE_BLOB}/uploads/f3a9.webp`,
    "/uploads/f3a9c1d2e4b5a6f7.webp",
  ])("accepts %s", (url) => {
    expect(isAllowedImageUrl(url, withBlob)).toBe(true);
  });

  it.each([
    "",
    "images/lego.png",
    "//evil.example.com/x.png",
    "/\\evil.example.com/x.png",
    "/images/../../etc/passwd",
    "http://www.lego.com/cdn/x.png",
    "https://www.lego.com/other/x.png",
    "https://www.lego.com/cdn/",
    "https://www.lego.com:8443/cdn/x.png",
    "https://user:pass@www.lego.com/cdn/x.png",
    "https://lego.com/cdn/x.png",
    "https://www.lego.com.evil.example/cdn/x.png",
    "https://public.blob.vercel-storage.com/x.webp",
    "https://a.b.public.blob.vercel-storage.com/x.webp",
    "https://evil.public.blob.vercel-storage.com.example/x.webp",
    "http://abc.public.blob.vercel-storage.com/x.webp",
    // Only this store's Blob store, and only its uploads.
    "https://attacker123.public.blob.vercel-storage.com/uploads/x.png",
    `https://${STORE_BLOB}/other/x.png`,
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "/images/with space.png",
    // next/image throws while rendering a site file with a query string (default images.localPatterns).
    "/images/x.png?v=1",
    "/images/sets/75349.png?v=2",
    "/images/x.png#top",
  ])("rejects %s", (url) => {
    expect(isAllowedImageUrl(url, withBlob)).toBe(false);
  });
});

describe("this store's Blob host", () => {
  it("is BLOB_PUBLIC_HOSTNAME, or the store id of BLOB_READ_WRITE_TOKEN, or none", () => {
    expect(blobPublicHostname({ BLOB_PUBLIC_HOSTNAME: " AbC123.public.blob.vercel-storage.com " })).toBe("abc123.public.blob.vercel-storage.com");
    expect(blobPublicHostname({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_AbC123xYz_s3cr3tPart" })).toBe("abc123xyz.public.blob.vercel-storage.com");
    expect(blobPublicHostname({})).toBeNull();
    expect(blobPublicHostname({ BLOB_READ_WRITE_TOKEN: "not-a-blob-token" })).toBeNull();
    expect(() => blobPublicHostname({ BLOB_PUBLIC_HOSTNAME: "evil.example" })).toThrow(/BLOB_PUBLIC_HOSTNAME/);
  });

  it("without a Blob store, no Blob URL is allowed", () => {
    expect(isAllowedImageUrl(`https://${STORE_BLOB}/uploads/f3a9.webp`, remoteImagePatterns(null))).toBe(false);
  });
});
