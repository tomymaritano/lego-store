import { test, expect } from "@playwright/test";

test.describe("Search", () => {
  test("should search for products", async ({ page }) => {
    await page.goto("/search");

    // Type in search input
    const searchInput = page.locator("input[type='text'], input[type='search']").first();
    await searchInput.fill("Star Wars");

    // Wait for results (debounced)
    await page.waitForTimeout(500);

    // Should show results
    const results = page.locator("[data-testid='product-card'], [data-testid='search-result']");
    await expect(results.first()).toBeVisible({ timeout: 5000 });
  });

  test("should navigate to search page from navbar", async ({ page }) => {
    await page.goto("/");

    // Click search icon in navbar
    const searchBtn = page.locator("[data-testid='search-button'], a[href='/search']");
    await searchBtn.first().click();

    // Should be on search page
    await expect(page).toHaveURL(/\/search/);
  });
});
