import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("should display the homepage with products", async ({ page }) => {
    await page.goto("/");

    // Check page title
    await expect(page).toHaveTitle(/LEGO Store/);

    // Check navbar is visible
    await expect(page.locator("nav")).toBeVisible();

    // Check products are displayed
    const products = page.locator("[data-testid='product-card']");
    await expect(products.first()).toBeVisible({ timeout: 10000 });
  });

  test("should navigate to product detail page", async ({ page }) => {
    await page.goto("/");

    // Click on first product
    const firstProduct = page.locator("[data-testid='product-card']").first();
    await firstProduct.click();

    // Should navigate to product page
    await expect(page).toHaveURL(/\/item\//);
  });

  test("should toggle dark mode", async ({ page }) => {
    await page.goto("/");

    // Find and click theme toggle
    const themeToggle = page.locator("[data-testid='theme-toggle']");
    if (await themeToggle.isVisible()) {
      await themeToggle.click();

      // Check dark class is applied to html
      await expect(page.locator("html")).toHaveClass(/dark/);
    }
  });
});
