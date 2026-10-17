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

test.describe("Search combobox focus", () => {
  test("closes the suggestions when keyboard focus leaves the field", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("combobox", { name: "Buscar productos" }).first();
    await input.focus();
    // Empty field, no recents: the panel shows only the popular chips, which are
    // not listbox options, so the combobox itself stays collapsed.
    const popular = page.getByText("Búsquedas populares");
    await expect(popular).toBeVisible();
    await expect(input).toHaveAttribute("aria-expanded", "false");

    // Tab walks through the panel (chips) and then out of the combobox.
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    await expect(popular).toBeHidden();

    // With recent searches the listbox has options and the combobox expands.
    await page.evaluate(() => localStorage.setItem("lego-recent-searches", JSON.stringify(["batman"])));
    await input.focus();
    await expect(input).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("option", { name: /batman/ })).toBeVisible();
  });
});
