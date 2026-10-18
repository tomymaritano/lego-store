import { test, expect, type Page } from "@playwright/test";
import { logIn } from "./helpers/accounts";
import { axeRuleViolations, seriousAxeViolations } from "./helpers/axe";
import { createE2eAccount } from "./helpers/db";

/**
 * Automated WCAG 2.1 AA checks (axe) across the app, once per theme. The
 * store-ops specs (e2e/store-ops) check the content editor's preview and a
 * message's page. The
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
  {
    name: "cart with a coupon",
    path: "/cart",
    setup: (page) =>
      seed(page, {
        "lego-cart-storage": { cart: [{ ...line, quantity: 3 }] },
        "lego-coupon-storage": { coupon: { code: "BIENVENIDA10", type: "PERCENT", value: 10, minSubtotal: 2000, label: "10% de descuento" } },
      }),
  },
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
  { name: "newsletter unsubscribe, bad link", path: "/newsletter/baja?token=no-es-un-token" },
  { name: "newsletter confirmation, bad link", path: "/newsletter/confirmar?token=no-es-un-token" },
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
      // The first search under the parallel workers can wait on the dev server's /api/search.
      await expect(page.getByRole("listbox").first()).toBeVisible({ timeout: 15_000 });
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
      // One login, then ~20 pages that may compile on first hit, next to the other workers.
      test.setTimeout(330_000);
      // An admin of its own (an admin's logout revokes its sessions: no other spec signs this one out).
      // It also has an /account, which every signed-in user shares.
      await page.goto("/login?callbackUrl=%2Fadmin");
      await logIn(page, await createE2eAccount("axe-admin", "Admin Axe", "ADMIN"));
      await expect(page.getByRole("heading", { level: 1, name: "Panel de administración" })).toBeVisible({ timeout: 30_000 });

      for (const path of [
        "/account/orders",
        "/admin/orders",
        "/admin/products",
        "/admin/products/new",
        "/admin/products/1",
        "/admin/reviews",
        "/admin/coupons",
        "/admin/coupons/new",
        "/admin/users",
        "/admin/audit",
        "/admin/categories",
        "/admin/categories/new",
        "/admin/themes",
        "/admin/themes/new",
        // A year, so the charts have bars wherever the dev database has orders.
        `/admin?from=${new Date(Date.now() - 360 * 24 * 3600 * 1000).toISOString().slice(0, 10)}`,
        "/admin/configuracion",
        "/admin/contenido",
        "/admin/contenido/privacidad",
        "/admin/mensajes",
        "/admin/newsletter",
      ]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
        await expectNoSeriousViolations(page);
        // The announcement preview is not a second "Anuncio" landmark; the editor's outline has no gaps.
        if (path === "/admin/configuracion" || path.startsWith("/admin/contenido/")) {
          expect(await axeRuleViolations(page, ["landmark-unique", "heading-order", "duplicate-id"])).toEqual([]);
        }
      }
      // A user's, a category's and a theme's page: the first row of each list.
      for (const [list, row] of [
        ["/admin/users", "admin-user-row"],
        ["/admin/categories", "admin-category-row"],
        ["/admin/themes", "admin-theme-row"],
      ] as const) {
        await page.goto(list);
        await page.getByTestId(row).first().getByRole("link").first().click();
        await expect(page).toHaveURL(new RegExp(`${list}/[^/]+$`), { timeout: 30_000 });
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
        await expectNoSeriousViolations(page);
      }
      // A coupon's page (the seed has two).
      await page.goto("/admin/coupons?q=BIENVENIDA10");
      await page.getByTestId("admin-coupon-row").first().getByRole("link").first().click();
      await expect(page.getByRole("heading", { level: 1, name: "BIENVENIDA10" })).toBeVisible({ timeout: 30_000 });
      await expectNoSeriousViolations(page);
      // An order's page, when the database has one (the checkout specs place them).
      await page.goto("/admin/orders");
      const firstOrder = page.getByTestId("admin-order-row").first().getByRole("link").first();
      if (await firstOrder.count()) {
        await firstOrder.click();
        await expect(page.getByRole("heading", { level: 1, name: /^Pedido/ })).toBeVisible({ timeout: 30_000 });
        await expectNoSeriousViolations(page);
      }
    });

    test.describe("coupon states", () => {
      const cart = { "lego-cart-storage": { cart: [{ ...line, quantity: 3 }] } };
      const seeded = { ...cart, "lego-coupon-storage": { coupon: { code: "BIENVENIDA10", type: "PERCENT", value: 10, minSubtotal: 2000, label: "10% de descuento" } } };

      test("cart: a refused code on the field", async ({ page }) => {
        await seed(page, cart);
        await page.goto("/cart");
        await page.getByLabel("Código de descuento").fill("NOEXISTE1");
        await page.getByRole("button", { name: "Aplicar" }).click();
        await expect(page.getByTestId("cart-coupon").getByRole("alert")).toHaveText(/no es válido/);
        await expect(page.getByLabel("Código de descuento")).toHaveAttribute("aria-invalid", "true");
        await expectNoSeriousViolations(page);
      });

      test("cart: a stored coupon the server took off, with the notice", async ({ page }) => {
        await seed(page, { ...cart, "lego-coupon-storage": { coupon: { code: "NOEXISTE2", type: "FIXED", value: 100, minSubtotal: 0, label: "$ 100 de descuento" } } });
        await page.goto("/cart");
        await expect(page.getByTestId("cart-coupon").getByRole("alert")).toHaveText(/Quitamos el cupón NOEXISTE2/);
        await expectNoSeriousViolations(page);
      });

      test("checkout with a coupon (desktop)", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await seed(page, seeded);
        await page.goto("/checkout");
        await expect(page.getByTestId("checkout-discount").first()).toBeVisible({ timeout: 30_000 });
        await expectNoSeriousViolations(page);
      });

      test("checkout with a coupon (390px, summary open)", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await seed(page, seeded);
        await page.goto("/checkout");
        await page.locator("summary", { hasText: "Ver resumen" }).click();
        await expect(page.getByTestId("checkout-mobile-coupon-applied")).toContainText("BIENVENIDA10", { timeout: 30_000 });
        await expect(page.getByTestId("checkout-mobile-discount")).toBeVisible();
        await expectNoSeriousViolations(page);
      });
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
