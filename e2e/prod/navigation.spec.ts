import { test, expect, type Page } from "@playwright/test";

/**
 * Runs against the production build (`next build` + `next start`, see the
 * "prod" project in playwright.config.ts). The dev server never shows
 * production-only router behaviour, such as a link falling back to a full
 * page load, which would also skip the page transition.
 */

declare global {
  interface Window {
    __navMarker?: number;
    __opacities?: number[];
  }
}

/** Marks the window and records the page wrapper's opacity on every frame. */
async function watchNavigation(page: Page) {
  await page.evaluate(() => {
    window.__navMarker = 1;
    window.__opacities = [];
    const tick = () => {
      const wrapper = document.querySelector("#main-content > div");
      if (wrapper) window.__opacities!.push(Number(getComputedStyle(wrapper).opacity));
      requestAnimationFrame(tick);
    };
    tick();
  });
}

async function expectClientNavigationWithTransition(page: Page) {
  const result = await page.evaluate(() => ({
    kept: window.__navMarker === 1,
    minOpacity: Math.min(...(window.__opacities ?? [1])),
  }));
  expect(result.kept, "navigation kept the window (no full page load)").toBe(true);
  expect(result.minOpacity, "the enter transition played").toBeLessThan(1);
}

test.describe("Production navigation", () => {
  test("home -> product -> home stays client-side and plays the page transition", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await watchNavigation(page);
    await page.locator("main a[href='/item/1']").first().click();
    await expect(page).toHaveURL(/\/item\/1$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectClientNavigationWithTransition(page);

    await watchNavigation(page);
    await page.getByRole("banner").locator("a[href='/']").first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectClientNavigationWithTransition(page);
  });

  test("search -> category and cart -> home stay client-side", async ({ page }) => {
    await page.goto("/search?q=star", { waitUntil: "networkidle" });
    await watchNavigation(page);
    await page.getByRole("banner").locator("a[href='/category/helmet']").first().click();
    await expect(page).toHaveURL(/\/category\/helmet$/);
    await expectClientNavigationWithTransition(page);

    await page.goto("/cart", { waitUntil: "networkidle" });
    await watchNavigation(page);
    await page.getByRole("banner").locator("a[href='/']").first().click();
    await expect(page).toHaveURL(/\/$/);
    await expectClientNavigationWithTransition(page);
  });
});
