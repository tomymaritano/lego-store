import { test, expect } from "@playwright/test";

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
    const cartBadge = page.locator("[data-testid='cart-badge']");
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
