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

  test("matches every term without accents, across category names (database search)", async ({ page }) => {
    // "vehiculos" is the display name of the cars category ("Vehículos"), "porsche" narrows it to one set.
    await page.goto("/search?q=vehiculos%20PORSCHE");
    const cards = page.getByTestId("product-card");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Porsche 911 GT3 RS");

    await page.goto("/search?q=vehiculos");
    await expect(page.getByTestId("product-card")).toHaveCount(5);
  });

  test("hostile query strings render results or nothing, never the error page", async ({ page, request }) => {
    for (const path of ["/search?q=lego&maxPrice=3000000000", "/search?q=%00", "/search?q=star&category=%00"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Algo salió mal" })).toHaveCount(0);
    }
    for (const path of ["/api/products?maxPrice=1e12", "/api/products/facets?minPrice=3000000000", "/api/search?q=%00"]) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
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
