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

    // Submit a query from the navbar search box
    const searchInput = page.getByTestId("search-input").first();
    await searchInput.fill("star");
    await searchInput.press("Enter");

    // Should be on the search page with the query
    await expect(page).toHaveURL(/\/search\?q=star/);
  });
});
