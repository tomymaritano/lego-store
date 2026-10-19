import { test, expect } from "@playwright/test";

/** The production build sends HSTS on top of the anti-framing headers, and no X-Powered-By (next.config.mjs). */
test("production responses carry the security headers", async ({ request }) => {
  for (const path of ["/", "/admin", "/api/products?page=1"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    const headers = response.headers();
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(headers["strict-transport-security"], path).toBe("max-age=63072000; includeSubDomains");
    expect(headers["x-powered-by"], path).toBeUndefined();
  }
});
