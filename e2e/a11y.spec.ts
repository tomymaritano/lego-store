import { test, expect, type Page } from "@playwright/test";
import { logIn } from "./helpers/accounts";
import { seriousAxeViolations } from "./helpers/axe";
import { createE2eAccount } from "./helpers/db";

/**
 * Automated WCAG 2.1 AA checks (axe) across the app, once per theme. The
 * checkout steps have their own axe checks in checkout.spec.ts; login,
 * register, /account and /admin's dashboard are in auth.spec.ts, and the
 * signed-in pages below (account orders, every admin section) run here.
 *
 * Content below the fold reveals as it scrolls into view, so each page is
 * scrolled through before axe runs, and axe is polled until entrance fades
 * have settled (a half-faded text would fail contrast).
 */

const line = { id: "1", name: "Captain Rex Helmet", price: 899, image: "/images/placeholder-product.svg", stock: 10 };

/** Seeds the persisted stores before the page's scripts run. */
const seed = (page: Page, entries: Record<string, unknown>) =>
  page.addInitScript((stores) => {
    for (const [key, state] of Object.entries(stores)) localStorage.setItem(key, JSON.stringify({ state, version: 1 }));
  }, entries);

async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 30)));
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  });
}

async function expectNoSeriousViolations(page: Page) {
  await scrollThrough(page);
  await expect.poll(() => seriousAxeViolations(page), { timeout: 15_000 }).toEqual([]);
}

const pages: Array<{ name: string; path: string; setup?: (page: Page) => Promise<unknown> }> = [
  { name: "home", path: "/" },
  { name: "search", path: "/search?q=star" },
  { name: "category", path: "/category/helmet" },
  { name: "product", path: "/item/1" },
  { name: "empty cart", path: "/cart" },
  { name: "cart", path: "/cart", setup: (page) => seed(page, { "lego-cart-storage": { cart: [{ ...line, quantity: 2 }] } }) },
  { name: "empty favourites", path: "/wishlist" },
  { name: "favourites", path: "/wishlist", setup: (page) => seed(page, { "lego-wishlist-storage": { wishlist: [line] } }) },
  { name: "compare", path: "/compare", setup: (page) => seed(page, { "lego-compare-storage": { ids: ["1", "2"] } }) },
  { name: "faq", path: "/faq" },
  { name: "about", path: "/nosotros" },
  { name: "shipping", path: "/envios" },
  { name: "returns", path: "/devoluciones" },
  { name: "contact", path: "/contacto" },
  { name: "privacy", path: "/privacidad" },
  { name: "terms", path: "/terminos" },
  { name: "not found", path: "/item/no-existe" },
];

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`axe (${colorScheme})`, () => {
    test.beforeEach(async ({ page }) => {
      // The default theme follows the system: emulating it covers both palettes.
      await page.emulateMedia({ colorScheme });
    });

    for (const { name, path, setup } of pages) {
      test(`${name} (${path})`, async ({ page }) => {
        await setup?.(page);
        await page.goto(path);
        await expect(page.locator("html")).toHaveClass(colorScheme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/);
        await expectNoSeriousViolations(page);
      });
    }

    test("search autocomplete listbox", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/");
      const search = page.getByRole("combobox", { name: /Buscar/ }).first();
      await search.fill("star");
      await expect(page.getByRole("listbox").first()).toBeVisible();
      await expect.poll(() => seriousAxeViolations(page), { timeout: 15_000 }).toEqual([]);
    });

    test("mobile filter sheet", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/search?q=star");
      await page.getByRole("button", { name: "Filtros" }).click();
      await expect(page.getByRole("dialog", { name: "Filtros" })).toBeVisible();
      await expect.poll(() => seriousAxeViolations(page), { timeout: 15_000 }).toEqual([]);
    });

    test("account and admin pages, signed in", async ({ page }) => {
      test.slow(); // one login, then ~8 pages that may compile on first hit
      // An admin of its own (an admin's logout revokes its sessions: no other spec signs this one out).
      // It also has an /account, which every signed-in user shares.
      await page.goto("/login?callbackUrl=%2Fadmin");
      await logIn(page, await createE2eAccount("axe-admin", "Admin Axe", "ADMIN"));
      await expect(page.getByRole("heading", { level: 1, name: "Panel de administración" })).toBeVisible({ timeout: 30_000 });

      for (const path of ["/account/orders", "/admin/orders", "/admin/products", "/admin/products/new", "/admin/products/1", "/admin/reviews"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
        await expectNoSeriousViolations(page);
      }
      // An order's page, when the database has one (the checkout specs place them).
      await page.goto("/admin/orders");
      const firstOrder = page.getByTestId("admin-order-row").first().getByRole("link").first();
      if (await firstOrder.count()) {
        await firstOrder.click();
        await expect(page.getByRole("heading", { level: 1, name: /^Pedido/ })).toBeVisible({ timeout: 30_000 });
        await expectNoSeriousViolations(page);
      }
    });

    test("cart drawer", async ({ page }) => {
      await seed(page, { "lego-cart-storage": { cart: [{ ...line, quantity: 1 }] } });
      await page.goto("/search?q=star");
      await page.getByTestId("cart-button").click();
      await expect(page.getByRole("dialog", { name: /Carrito/ })).toBeVisible();
      await expect.poll(() => seriousAxeViolations(page), { timeout: 15_000 }).toEqual([]);
    });
  });
}
