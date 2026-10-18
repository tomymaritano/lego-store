import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.mjs";
import { isAllowedImageUrl, REMOTE_IMAGE_PATTERNS } from "@/lib/images";

describe("product picture URLs", () => {
  it("allows exactly what next.config.mjs lets next/image load", () => {
    expect(nextConfig.images?.remotePatterns).toEqual(REMOTE_IMAGE_PATTERNS);
    // No localPatterns: Next's default refuses site files with a query string, and so does isAllowedImageUrl.
    expect(nextConfig.images?.localPatterns).toBeUndefined();
  });

  it.each([
    "/images/lego.png",
    "https://www.lego.com/cdn/cs/set/assets/bltde62e4576a817dd4/75349.png",
    "  https://www.lego.com/cdn/x.png  ",
  ])("accepts %s", (url) => {
    expect(isAllowedImageUrl(url)).toBe(true);
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
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "/images/with space.png",
    // next/image throws while rendering a site file with a query string (default images.localPatterns).
    "/images/x.png?v=1",
    "/images/sets/75349.png?v=2",
    "/images/x.png#top",
  ])("rejects %s", (url) => {
    expect(isAllowedImageUrl(url)).toBe(false);
  });
});
