import { test, expect, type Page } from "@playwright/test";

/**
 * Records every scale animation started on the Navbar cart icon (the bump
 * runs on the Web Animations API), so the test checks what was triggered
 * instead of sampling a 300 ms animation's computed style under load.
 */
const recordCartBumps = (page: Page) =>
  page.addInitScript(() => {
    const bumps: number[] = [];
    (window as unknown as { __cartBumps: number[] }).__cartBumps = bumps;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const scales = (Array.isArray(keyframes) ? [] : ((keyframes as PropertyIndexedKeyframes)?.scale ?? [])) as number[];
      if (this.closest("[data-testid='cart-button']") && scales.length) bumps.push(Math.max(...scales.map(Number)));
      return animate.call(this, keyframes, options);
    };
  });
const cartBumps = (page: Page) => page.evaluate(() => (window as unknown as { __cartBumps: number[] }).__cartBumps);

test.describe("Cart", () => {
  test("should add product to cart", async ({ page }) => {
    await page.goto("/");

    // Go to a product page
    const firstProduct = page.locator("[data-testid='product-card']").first();
    await firstProduct.click();

    // Wait for product page to load
    await expect(page).toHaveURL(/\/item\//);

    // Click add to cart button
    const addToCartBtn = page.locator("button", { hasText: /agregar|añadir|cart/i });
    await addToCartBtn.first().click();

    // Cart badge should show item
    const cartBadge = page.locator("[data-testid='cart-count']");
    await expect(cartBadge).toBeVisible({ timeout: 5000 });
  });

  test("should display empty cart message", async ({ page }) => {
    // Clear localStorage before test
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());

    await page.goto("/cart");

    // Should show empty cart message
    const emptyMessage = page.locator("text=/vacío|empty|no hay/i");
    await expect(emptyMessage).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Add to cart from a product card", () => {
  test("cards are not tab stops and adding keeps focus on the button", async ({ page }) => {
    await page.goto("/search?q=star");
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    expect(await page.locator("article[tabindex]").count()).toBe(0);

    const button = page.getByTestId("product-card").nth(1).getByTestId("add-to-cart-btn");
    await button.focus();
    await page.keyboard.press("Enter");

    await expect(button).toHaveText("Ver carrito");
    await expect(button).toBeEnabled();
    await expect(button).toBeFocused();

    // Opens the cart drawer; closing it brings focus back to the same button.
    await page.keyboard.press("Enter");
    const drawer = page.getByRole("dialog", { name: /Carrito/ });
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("search results keep a heading between the h1 and the cards", async ({ page }) => {
    await page.goto("/search?q=star");
    await expect(page.getByRole("heading", { level: 2, name: "Productos" })).toBeAttached();
  });
});

test.describe("Navbar cart feedback", () => {
  test("names the cart in correct Spanish and bumps only on a new add", async ({ page }) => {
    await recordCartBumps(page);
    await page.goto("/search?q=star");
    await page.getByTestId("product-card").first().getByTestId("add-to-cart-btn").click();
    await expect(page.getByRole("button", { name: "Carrito, 1 producto" })).toBeVisible();

    // Full reload with a non-empty cart: the icon must stay still.
    await page.reload();
    await expect(page.getByRole("button", { name: "Carrito, 1 producto" })).toBeVisible();
    await page.waitForTimeout(500);
    expect(await cartBumps(page)).toEqual([]);

    // A real add does bump it.
    await page.getByTestId("product-card").nth(1).getByTestId("add-to-cart-btn").click();
    await expect.poll(async () => Math.max(0, ...(await cartBumps(page)))).toBeGreaterThan(1.05);
    await expect(page.getByRole("button", { name: "Carrito, 2 productos" })).toBeVisible();
  });
});

test.describe("Cart drawer", () => {
  test("opening the drawer clears the add-to-cart toast over its footer", async ({ page }) => {
    await page.goto("/search?q=star");
    const button = page.getByTestId("product-card").first().getByTestId("add-to-cart-btn");
    await button.click();
    const toast = page.locator("[data-sonner-toast]");
    await expect(toast).toBeVisible();

    await button.click(); // now "Ver carrito"
    await expect(page.getByRole("dialog", { name: /Carrito/ })).toBeVisible();
    await expect(toast).toHaveCount(0);
  });
});

test.describe("In-cart state after a full load", () => {
  test("cards of products already in the persisted cart read 'Ver carrito'", async ({ page }) => {
    await page.addInitScript(() => {
      const line = { id: "1", name: "Captain Rex Helmet", price: 899, image: "/images/lego.png", quantity: 1, stock: 10 };
      localStorage.setItem("lego-cart-storage", JSON.stringify({ state: { cart: [line] }, version: 1 }));
    });
    for (const path of ["/search?q=star", "/category/helmet"]) {
      await page.goto(path);
      const inCart = page.locator("[data-testid='add-to-cart-btn'][data-in-cart]").first();
      await expect(inCart).toHaveText("Ver carrito");
      await expect(page.locator("[data-testid='add-to-cart-btn']:not([data-in-cart]):not([disabled])").first()).toHaveText(
        /Agregar/
      );
    }
  });
});
