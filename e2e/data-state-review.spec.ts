import { test, expect } from "@playwright/test";

test.describe("Search combobox focus", () => {
  test("closes the suggestions when keyboard focus leaves the field", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("combobox", { name: "Buscar productos" }).first();
    await input.focus();
    await expect(input).toHaveAttribute("aria-expanded", "true");

    // Tab walks through the panel (chips) and then out of the combobox.
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    await expect(input).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("Product page", () => {
  test("reviews sit inside the page gutter and use h3 titles", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/item/1");
    const heading = page.getByRole("heading", { level: 2, name: "Reseñas de clientes" });
    await heading.scrollIntoViewIfNeeded();
    const box = await heading.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(16);
    const section = page.getByRole("region", { name: "Reseñas de clientes" });
    await expect(section.getByRole("heading", { level: 3 }).first()).toBeVisible();
    await expect(section.getByRole("heading", { level: 4 })).toHaveCount(0);
  });

  test("the purchase actions fit at 390px: CTA on top, three icons in one row", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/item/1");
    const tops = await Promise.all(
      ["Agregar a favoritos", "Agregar a la comparación", "Compartir"].map(async (name) => {
        const box = await page.getByRole("button", { name, exact: true }).boundingBox();
        return Math.round(box!.y);
      })
    );
    expect(new Set(tops).size).toBe(1);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });

  test("broken gallery images are dropped instead of showing an empty thumbnail", async ({ page }) => {
    await page.goto("/item/1");
    const thumbs = page.getByRole("group", { name: /Imágenes de/ }).getByRole("button");
    await expect
      .poll(() => thumbs.evaluateAll((buttons) => buttons.filter((b) => !(b.querySelector("img") as HTMLImageElement)?.naturalWidth).length))
      .toBe(0);
  });
});

test.describe("Compare and quick view", () => {
  test("show the category display name, not the slug", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("lego-compare-storage", JSON.stringify({ state: { ids: ["1"] }, version: 1 }));
    });
    await page.goto("/compare");
    const row = page.getByRole("row", { name: /Categoría/ });
    await expect(row).toContainText("Helmets");
  });

  test("the compare bar hides on cart and checkout and reserves room elsewhere", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("lego-compare-storage", JSON.stringify({ state: { ids: ["1"] }, version: 1 }));
    });
    const bar = page.getByRole("complementary", { name: "Comparación de productos" });

    await page.goto("/item/2");
    await expect(bar).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-compare-bar", "");

    await page.goto("/cart");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeAttached();
    await expect(bar).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveAttribute("data-compare-bar");
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
