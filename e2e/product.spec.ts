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

    await buyButton(page).click();
    await expect(buyButton(page)).toHaveText(/Agregado al carrito/);
    await expect(page.getByTestId("cart-count").first()).toHaveText("3");
    await expect(page.getByText("Tienes 3 en tu carrito")).toBeVisible();
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

  test("the review form validates in Spanish and publishes a review", async ({ page }) => {
    await page.goto("/item/2");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: /Ver reseñas/ }).click();
    await expect(page.getByRole("tab", { name: /Reseñas/ })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("button", { name: "Escribir reseña" }).click();
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
