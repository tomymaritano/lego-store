import { test, expect, type Page } from "@playwright/test";

/** The buy box CTA (related product cards below share the test id). */
const buyButton = (page: Page) => page.getByTestId("add-to-cart-btn").first();

/** Waits until the client stores have loaded localStorage (the item page then shows hydrated state). */
const ready = async (page: Page) => {
  await page.waitForLoadState("networkidle");
  await expect(buyButton(page)).toBeEnabled();
};

test.describe("Product page", () => {
  test("adds the chosen quantity to the cart and caps it at the stock left", async ({ page }) => {
    await page.goto("/item/1");
    await ready(page);
    const quantity = page.getByRole("group", { name: "Cantidad de Captain Rex Helmet" });
    const more = quantity.getByRole("button", { name: "Aumentar cantidad" });
    await more.click();
    await more.click();
    await expect(quantity).toContainText("3");

    const before = (await buyButton(page).boundingBox())!;
    await buyButton(page).click();
    await expect(buyButton(page)).toHaveText(/Agregado al carrito/);
    await expect(page.getByTestId("cart-count").first()).toHaveText("3");
    await expect(page.getByText("Tienes 3 en tu carrito")).toBeVisible();
    // The in-cart note appears below the actions: the button never moves under the pointer.
    expect((await buyButton(page).boundingBox())!.y).toBeCloseTo(before.y, 0);
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("lego-cart-storage")!).state.cart[0].quantity))
      .toBe(3);

    // Stock is 10: 7 left, so the stepper stops there.
    await expect(quantity).toContainText("1");
    for (let i = 0; i < 6; i++) await more.click();
    await expect(quantity).toContainText("7");
    await expect(more).toHaveAttribute("aria-disabled", "true");
  });

  test("an unknown id is a real 404 with the not-found page", async ({ page, request }) => {
    expect((await request.get("/item/no-existe")).status()).toBe(404);
    expect((await request.get("/item/1")).status()).toBe(200);
    const response = await page.goto("/item/no-existe");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/no encontr/i);
  });

  test("ships Product JSON-LD", async ({ page }) => {
    await page.goto("/item/1");
    const json = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!);
    expect(json).toMatchObject({ "@type": "Product", name: "Captain Rex Helmet", offers: { price: 899, priceCurrency: "ARS" } });
  });

  test("the reviews link opens the tab and moves focus to the reviews heading", async ({ page }) => {
    await page.goto("/item/1");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: /^Ver \d+ reseñas?$/ }).click();
    await expect(page.getByRole("tab", { name: /Reseñas/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { level: 2, name: "Reseñas de clientes" })).toBeFocused();
  });

  test("product cards show the catalogue rating without an invented review count", async ({ page }) => {
    await page.goto("/item/10");
    const cards = page.getByRole("img", { name: /^Valoración: / });
    await expect(cards.first()).toBeVisible();
    await expect(page.getByRole("img", { name: /reseñas/ })).toHaveCount(0);
  });

  test("the review form validates in Spanish and publishes a review", async ({ page }) => {
    await page.goto("/item/2");
    await page.waitForLoadState("networkidle");
    // Item 2 has no reviews yet: the link under the title opens the form on its first field.
    await page.getByRole("link", { name: "Escribir una reseña" }).click();
    await expect(page.getByRole("tab", { name: /Reseñas/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("radio", { name: "1 estrella" })).toBeFocused();
    // No score or histogram for a product without reviews, only the empty state.
    await expect(page.getByRole("heading", { level: 3, name: "Aún no hay reseñas" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Distribución de valoraciones" })).toHaveCount(0);

    await page.getByRole("button", { name: "Publicar reseña" }).click();
    await expect(page.getByText("Elige una calificación de 1 a 5 estrellas")).toBeVisible();
    await expect(page.getByText("Ingresa tu nombre (al menos 2 caracteres)")).toBeVisible();
    await expect(page.getByText("Escribe un título (al menos 3 caracteres)")).toBeVisible();
    await expect(page.getByText("Cuéntanos un poco más (al menos 10 caracteres)")).toBeVisible();
    await expect(page.getByRole("radio", { name: "1 estrella" })).toBeFocused();

    // The radios are visually hidden; the visible star is their label.
    await page.getByRole("radio", { name: "5 estrellas" }).locator("..").click();
    await page.getByLabel("Tu nombre").fill("Lucía");
    await page.getByLabel("Título").fill("Precioso en la repisa");
    await page.getByLabel("Tu reseña").fill("Se arma rápido y queda espectacular.");
    await page.getByRole("button", { name: "Publicar reseña" }).click();

    await expect(page.getByRole("heading", { level: 3, name: "Precioso en la repisa" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Reseñas/ })).toContainText("1");
  });

  test("an invalid review submit shows the focused rating group below the sticky header", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 600 });
    await page.goto("/item/1");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: /Ver 2 reseñas/ }).click();
    await page.getByRole("button", { name: "Escribir reseña" }).click();
    await page.getByRole("button", { name: "Publicar reseña" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("radio", { name: "1 estrella" })).toBeFocused();

    const headerBottom = await page.locator("[data-site-header]").evaluate((el) => el.getBoundingClientRect().bottom);
    const group = page.getByRole("radiogroup", { name: /Tu calificación/ });
    await expect
      .poll(() => group.evaluate((el) => el.querySelector("legend")!.getBoundingClientRect().top))
      .toBeGreaterThanOrEqual(headerBottom);
    await expect(page.getByText("Elige una calificación de 1 a 5 estrellas")).toBeInViewport();
  });

  test("gallery: arrow keys and thumbnails change the picture", async ({ page }) => {
    await page.goto("/item/10");
    await page.waitForLoadState("networkidle");
    const thumbs = page.getByRole("group", { name: /Imágenes de/ });
    await thumbs.getByRole("button", { name: "Ver imagen 1 de 3" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(thumbs.getByRole("button", { name: "Ver imagen 2 de 3" })).toHaveAttribute("aria-pressed", "true");
    await expect(thumbs.getByRole("button", { name: "Ver imagen 2 de 3" })).toBeFocused();

    const zoom = page.getByRole("button", { name: /Ampliar imagen/ });
    await expect(zoom).toHaveCount(1); // the outgoing slide has left
    await zoom.focus();
    await page.keyboard.press("ArrowRight");
    await expect(thumbs.getByRole("button", { name: "Ver imagen 3 de 3" })).toHaveAttribute("aria-pressed", "true");
    // Focus follows the new picture instead of dropping to the page.
    await expect(zoom).toHaveCount(1);
    await expect(zoom).toBeFocused();
  });

  test("client-side navigation between products records each view", async ({ page }) => {
    await page.goto("/item/1");
    await page.waitForLoadState("networkidle");
    const related = page.getByRole("list", { name: "Productos relacionados" }).getByTestId("product-name").first();
    const href = await related.getAttribute("href");
    await related.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    const id = href!.split("/").pop();
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("lego-recently-viewed") ?? "{}").state?.ids))
      .toEqual([id, "1"]);
    await expect(page.getByRole("region", { name: "Vistos recientemente" })).toContainText("Captain Rex Helmet");

    // A full reload keeps the history instead of overwriting it.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("lego-recently-viewed")!).state.ids))
      .toEqual([id, "1"]);
  });
});

test.describe("Product page layout", () => {
  test("reviews sit inside the page gutter and use h3 titles", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/item/1");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: /Reseñas/ }).click();
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
