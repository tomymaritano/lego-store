import { test, expect, type Page } from "@playwright/test";

/** Scale of the navbar cart icon (the bump target), 1 when untransformed. */
/** The cart icon's current scale: the bump animates the `scale` property (Web Animations), older code used transform. */
const cartIconScale = (page: Page) =>
  page.getByTestId("cart-button").locator("span").first().evaluate((el) => {
    const style = getComputedStyle(el);
    const scale = style.scale === "none" || !style.scale ? 1 : parseFloat(style.scale);
    const transform = style.transform === "none" ? 1 : new DOMMatrixReadOnly(style.transform).a;
    return scale * transform;
  });

test.describe("Stale persisted ids", () => {
  test("compare drops ids the catalogue no longer has, freeing their slots", async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem(
        "lego-compare-storage",
        JSON.stringify({ state: { ids: ["999", "1", "998", "997"] }, version: 1 })
      );
    });
    await page.goto("/compare");
    await expect(page.getByRole("table")).toContainText("Captain Rex Helmet");
    await expect(page.getByText("1 de 4 productos como máximo")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("lego-compare-storage")!).state.ids))
      .toEqual(["1"]);

    await page.goto("/item/2");
    await expect(page.getByRole("complementary", { name: "Comparación de productos" })).toContainText("1 de 4");
  });

  test("wishlist drops snapshots of products that no longer exist", async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem(
        "lego-wishlist-storage",
        JSON.stringify({
          state: {
            wishlist: [
              { id: "999", name: "Set retirado", price: 100, image: "/images/lego.png", stock: 1 },
              { id: "1", name: "Captain Rex Helmet", price: 899, image: "/images/lego.png", stock: 3 },
            ],
          },
          version: 1,
        })
      );
    });
    await page.goto("/wishlist");
    await expect(page.getByRole("link", { name: "Captain Rex Helmet" })).toBeVisible();
    await expect(page.getByText("Set retirado")).toHaveCount(0);
    await expect(page.getByTestId("wishlist-count")).toHaveText("1");
  });
});

test.describe("Product card keyboard flow", () => {
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
    await page.goto("/search?q=star");
    await page.getByTestId("product-card").first().getByTestId("add-to-cart-btn").click();
    await expect(page.getByRole("button", { name: "Carrito, 1 producto" })).toBeVisible();

    // Full reload with a non-empty cart: the icon must stay still.
    await page.reload();
    await expect(page.getByRole("button", { name: "Carrito, 1 producto" })).toBeVisible();
    const samples: number[] = [];
    for (let i = 0; i < 10; i++) {
      samples.push(await cartIconScale(page));
      await page.waitForTimeout(50);
    }
    expect(Math.max(...samples)).toBeLessThan(1.01);

    // A real add does bump it.
    await page.getByTestId("product-card").nth(1).getByTestId("add-to-cart-btn").click();
    await expect.poll(() => cartIconScale(page), { intervals: [10], timeout: 2000 }).toBeGreaterThan(1.05);
    await expect(page.getByRole("button", { name: "Carrito, 2 productos" })).toBeVisible();
  });
});
