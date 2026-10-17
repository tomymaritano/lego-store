import { test, expect } from "@playwright/test";

test.describe("Persisted state", () => {
  test("compare and wishlist survive a reload and hydrate from the API", async ({ page }) => {
    await page.goto("/");
    const card = page.getByTestId("product-card").first();
    const name = (await card.getByTestId("product-name").textContent())!.trim();

    await card.hover();
    await card.getByRole("button", { name: `Comparar ${name}` }).click();
    await card.getByRole("button", { name: `Agregar ${name} a favoritos` }).click();

    await expect(page.getByRole("complementary", { name: "Comparación de productos" })).toContainText("1 de 4");
    await expect(page.getByTestId("wishlist-count")).toHaveText("1");

    // Stored as ids, fetched fresh on the compare page.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("lego-compare-storage")!));
    expect(stored).toEqual({ state: { ids: [expect.any(String)] }, version: 1 });

    await page.goto("/compare");
    await expect(page.getByRole("heading", { level: 1, name: "Comparar productos" })).toBeVisible();
    await expect(page.getByRole("table")).toContainText(name);

    await page.goto("/wishlist");
    await expect(page.getByRole("link", { name })).toBeVisible();
  });

  test("migrates a legacy compare list (full products) to ids", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "lego-compare-storage",
        JSON.stringify({ state: { items: [{ id: "1", name: "Captain Rex Helmet", price: 899 }] }, version: 0 })
      );
    });
    await page.goto("/compare");
    await expect(page.getByRole("table")).toContainText("Captain Rex Helmet");
  });

  test("applies the saved dark theme before hydration", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("lego-theme-storage", JSON.stringify({ state: { theme: "dark" }, version: 1 }));
    });
    // The inline <head> script runs while parsing, before React loads.
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("autocomplete asks the search API", async ({ page }) => {
    await page.goto("/");
    const input = page.getByTestId("search-input").first();
    const response = page.waitForResponse((res) => res.url().includes("/api/search?q=rex"));
    await input.fill("rex");
    await response;
    await expect(page.getByRole("option", { name: /Captain Rex Helmet/ })).toBeVisible();
  });
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
