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

test.describe("Production status codes", () => {
  test("an unknown product is a real 404, a known one is 200", async ({ request }) => {
    expect((await request.get("/item/nope")).status()).toBe(404);
    const ok = await request.get("/item/1");
    expect(ok.status()).toBe(200);
    expect(await ok.text()).toContain("application/ld+json");
  });

  test("an unknown category is a real 404, a known one is 200", async ({ request }) => {
    expect((await request.get("/category/nope")).status()).toBe(404);
    expect((await request.get("/category/nope?theme=Marvel")).status()).toBe(404);
    const ok = await request.get("/category/helmet?theme=Marvel");
    expect(ok.status()).toBe(200);
    expect(await ok.text()).toContain("Helmets");
  });

  test("a category page's server HTML is the whole category; the URL's filters apply after hydration", async ({ page, request }) => {
    const html = await (await request.get("/category/helmet?onSale=1")).text();
    // The server HTML is the unfiltered category…
    expect(html).toContain("Tusken Raider");
    // …and the client narrows it to what the URL asks for.
    await page.goto("/category/helmet?onSale=1");
    await expect(page.getByTestId("result-count")).toContainText("2 productos");
    await expect(page.getByRole("region", { name: "Filtros activos" })).toBeVisible();
    await page.getByRole("button", { name: /^Quitar filtro/ }).first().click();
    await expect(page).toHaveURL(/\/category\/helmet$/);
    await expect(page.getByTestId("result-count")).toContainText("5 productos");
  });

  test("an unknown category still shows the not-found page", async ({ page }) => {
    const response = await page.goto("/category/nope");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("Home server HTML", () => {
  test("hero copy is not hidden before hydration (LCP, no-JS)", async ({ request }) => {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);
    const html = await response.text();
    const start = html.indexOf('aria-labelledby="hero-title"');
    const end = html.indexOf('id="hero-title"');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    // Motion serialises its initial state inline; the hero only moves, it never starts transparent.
    expect(html.slice(start, end)).not.toMatch(/opacity:\s*0(?![.\d])/);
  });
});
