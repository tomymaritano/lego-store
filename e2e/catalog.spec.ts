import { test, expect, type Page } from "@playwright/test";

const count = (page: Page) => page.getByTestId("result-count");
const sidebar = (page: Page) => page.getByRole("complementary", { name: "Filtros" });
const prices = (page: Page) =>
  page.getByTestId("product-price").evaluateAll((nodes) =>
    // The first span is the current price ("Precio actual: $ 649" when discounted).
    nodes.map((node) => Number((node.querySelector(":scope > span")?.textContent ?? "").replace(/[^\d]/g, "")))
  );

test.describe("Catalogue filters and sort (URL state)", () => {
  test("a filter goes into the URL, keeps focus, and Back undoes it", async ({ page }) => {
    await page.goto("/search");
    await expect(count(page)).toContainText("22 productos");

    const onSale = sidebar(page).getByRole("checkbox", { name: /En oferta/ });
    await onSale.click();
    await expect(page).toHaveURL(/\/search\?onSale=1$/);
    await expect(onSale).toBeChecked();
    await expect(onSale).toBeFocused();
    await expect(count(page)).not.toContainText("22 productos");
    await expect(page.getByRole("button", { name: "Quitar filtro Disponibilidad: En oferta" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/search$/);
    await expect(onSale).not.toBeChecked();
    await expect(count(page)).toContainText("22 productos");

    await page.goForward();
    await expect(page).toHaveURL(/onSale=1/);
    await expect(onSale).toBeChecked();
  });

  test("a shared URL renders the filtered view; removing the last chip moves focus to the count", async ({ page }) => {
    await page.goto("/search?theme=Marvel");
    await expect(count(page)).toContainText("3 productos");
    await expect(sidebar(page).getByRole("checkbox", { name: /Marvel/ })).toBeChecked();
    await expect(page.getByTestId("product-card")).toHaveCount(3);

    await page.getByRole("button", { name: "Quitar filtro Tema: Marvel" }).click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(count(page)).toBeFocused();
    await expect(count(page)).toContainText("22 productos");
  });

  test("facet counts follow the other active filters", async ({ page }) => {
    await page.goto("/search");
    const filters = sidebar(page);
    await expect(filters.getByRole("checkbox", { name: "En oferta (6)" })).toBeVisible();

    await filters.getByRole("checkbox", { name: /Novedades/ }).click();
    await expect(page).toHaveURL(/\/search\?isNew=1$/);
    // Each count is what checking the option would show with Novedades kept.
    const onSale = filters.getByRole("checkbox", { name: /^En oferta \(\d+\)$/ });
    await expect(onSale).toHaveAccessibleName("En oferta (1)");
    await expect(filters.getByRole("radio", { name: /^Helmets/ })).toHaveAccessibleName("Helmets (2)");

    await onSale.click();
    await expect(count(page)).toContainText("1 producto");
  });

  test("sort select orders the results and is kept in the URL", async ({ page }) => {
    await page.goto("/category/helmet");
    await page.getByTestId("product-sort").click();
    await page.getByRole("option", { name: "Precio: menor a mayor" }).click();
    await expect(page).toHaveURL(/\/category\/helmet\?sort=price-asc$/);
    await expect.poll(async () => {
      const list = await prices(page);
      return list.length > 1 && list.every((price, i) => i === 0 || list[i - 1] <= price);
    }).toBe(true);

    await page.reload();
    await expect(page.getByTestId("product-sort")).toContainText("Precio: menor a mayor");
  });

  test("filters with no match show an empty state that clears them", async ({ page }) => {
    await page.goto("/search?q=star&minRating=4.5&isNew=1&theme=Technic");
    await expect(page.getByTestId("catalog-empty")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page).toHaveURL(/\/search\?q=star$/);
    await expect(page.getByTestId("product-card").first()).toBeVisible();
  });

  test("the price slider works from the keyboard: focus stays on the thumb, the URL follows", async ({ page }) => {
    await page.goto("/search");
    const max = sidebar(page).getByRole("slider", { name: "Precio máximo" });
    const start = Number(await max.getAttribute("aria-valuenow"));
    await max.focus();
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(600);
      await expect(max).toBeFocused();
    }
    await expect(page).toHaveURL(new RegExp(`maxPrice=${start - 150}$`));
    await expect(max).toHaveAttribute("aria-valuenow", String(start - 150));

    // Held keys commit once, after the pause.
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(new RegExp(`maxPrice=${start - 250}$`));
    await expect(max).toBeFocused();

    // Removing the chip resets the slider (it follows the URL).
    await page.getByRole("button", { name: /^Quitar filtro Precio/ }).click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(max).toHaveAttribute("aria-valuenow", String(start));
  });

  test("the sidebar's Limpiar keeps keyboard focus on the result count", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/search?theme=Star%20Wars&onSale=1");
    const clearButton = sidebar(page).getByRole("button", { name: "Limpiar" });
    await clearButton.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/search$/);
    await expect(count(page)).toBeFocused();
  });

  test("a stray ?category= on a category page is not an active filter", async ({ page }) => {
    await page.goto("/category/helmet?category=technic");
    await expect(count(page)).toContainText("5 productos");
    await expect(page.getByRole("region", { name: "Filtros activos" })).toHaveCount(0);
    await expect(sidebar(page).getByRole("button", { name: "Limpiar" })).toHaveCount(0);
  });

  test("mobile: filters open in a sheet and its footer shows the live count", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/search?q=star");
    await page.getByRole("button", { name: "Filtros" }).click();
    const sheet = page.getByRole("dialog", { name: "Filtros" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("checkbox", { name: /Novedades/ }).click();
    await expect(page).toHaveURL(/isNew=1/);
    const done = sheet.getByRole("button", { name: /^Ver \d+ productos?$/ });
    await expect(done).toBeVisible();
    await done.click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: "Filtros 1 activo" })).toBeFocused();
  });
});

test.describe("Search page", () => {
  test("no results suggest themes and categories", async ({ page }) => {
    await page.goto("/search?q=zzzz");
    const empty = page.getByTestId("search-empty");
    await expect(empty.getByRole("heading", { name: "No encontramos sets para “zzzz”" })).toBeVisible();
    await expect(empty.getByRole("heading", { level: 3, name: "Temas populares" })).toBeVisible();
    await empty.getByRole("navigation", { name: "Temas populares" }).getByRole("link", { name: "Marvel" }).click();
    await expect(page).toHaveURL(/\/search\?q=Marvel$/);
    await expect(page.getByTestId("product-card").first()).toBeVisible();
  });

  test("/search without a query is the whole catalogue with a category facet", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByRole("heading", { level: 1, name: "Catálogo" })).toBeVisible();
    await sidebar(page).getByRole("radio", { name: /Helmets/ }).click();
    await expect(page).toHaveURL(/category=helmet/);
    await expect(count(page)).toContainText("5 productos");
  });
});

test.describe("Quick view", () => {
  test("opens from the keyboard, closes on Escape and returns focus", async ({ page }) => {
    await page.goto("/category/helmet");
    const trigger = page.getByRole("button", { name: /^Vista rápida de/ }).first();
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading")).toHaveText(/Helmet/);

    // Adding keeps the button enabled and focused.
    const add = dialog.getByTestId("quick-view-add");
    await add.click();
    await expect(add).toBeFocused();
    await expect(dialog.getByText("Ya tienes 1 en el carrito")).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("Home", () => {

  test("sections render and the catalogue loads more on scroll", async ({ page }) => {
    await page.goto("/");
    for (const name of ["Explora por categoría", "Novedades", "Ofertas especiales", "Todos los productos", "Arma tu próxima aventura"]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
    const catalogue = page.getByRole("region", { name: "Todos los productos" }).getByTestId("product-card");
    await expect(catalogue).toHaveCount(12);
    await page.getByText("Cargar más productos").or(page.getByText(/Has visto los \d+ productos/)).scrollIntoViewIfNeeded();
    await expect(catalogue).toHaveCount(22);
  });
});
