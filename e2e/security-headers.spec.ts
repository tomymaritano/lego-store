import { test, expect } from "@playwright/test";
import { E2E_ADMIN_EMAIL, logIn } from "./helpers/accounts";

/*
 * Anti-framing and the other security headers (next.config.mjs): the signed-in
 * admin panel and account pages must never load inside another site's iframe
 * (clickjacking of cancel/refund, stock edits, review deletion).
 */

test("the signed-in admin panel refuses to be framed", async ({ page }) => {
  test.slow();
  await page.goto(`/login?callbackUrl=${encodeURIComponent("/admin/orders")}`);
  await logIn(page, E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/admin\/orders$/, { timeout: 30_000 });

  for (const path of ["/admin/orders", "/account", "/"]) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(200);
    const headers = response.headers();
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"], path).toContain("object-src 'none'");
    expect(headers["content-security-policy"], path).toContain("base-uri 'self'");
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"], path).toBeUndefined();
  }
});
