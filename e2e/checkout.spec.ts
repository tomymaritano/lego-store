import { test, expect, type Page } from "@playwright/test";

const seedCart = (page: Page, cart: unknown[]) =>
  page.addInitScript((lines) => {
    // Seed once per test, so the cart cleared by the order stays cleared.
    if (!sessionStorage.getItem("seeded:cart")) {
      localStorage.setItem("lego-cart-storage", JSON.stringify({ state: { cart: lines }, version: 1 }));
      sessionStorage.setItem("seeded:cart", "1");
    }
  }, cart);

const line = (id: string, name: string, price: number, quantity = 1) => ({
  id,
  name,
  price,
  image: "/images/lego.png",
  quantity,
  stock: 10,
});

const nextYear = String((new Date().getFullYear() + 1) % 100).padStart(2, "0");

async function fillShipping(page: Page) {
  await page.getByLabel(/^Nombre/).fill("Ana");
  await page.getByLabel(/^Apellido/).fill("Pérez");
  await page.getByLabel(/^Email/).fill("ana@example.com");
  await page.getByLabel(/^Teléfono/).fill("11 5555 1234");
  await page.getByLabel(/^Dirección/).fill("Av. Corrientes 1234");
  await page.getByLabel(/^Ciudad/).fill("Córdoba");
  await page.getByLabel(/^Código postal/).fill("X5000ABC");
  await page.getByRole("combobox", { name: /Provincia/ }).click();
  await page.getByRole("option", { name: "Córdoba" }).click();
}

async function fillPayment(page: Page) {
  await page.getByLabel(/^Número de tarjeta/).pressSequentially("4242424242424242");
  await page.getByLabel(/^Nombre en la tarjeta/).fill("ANA PEREZ");
  await page.getByLabel(/^Vencimiento/).pressSequentially(`12${nextYear}`);
  await page.getByLabel(/^Código de seguridad/).pressSequentially("123");
}

const stepper = (page: Page) => page.getByRole("navigation", { name: "Pasos del checkout" });

test.describe("Checkout", () => {
  test.beforeEach(async ({ page }) => {
    await seedCart(page, [line("1", "Captain Rex Helmet", 899, 2), line("2", "Princess Leia Helmet", 649)]);
  });

  test("happy path: shipping, payment, review and confirmation", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { level: 1, name: "Finalizar compra" })).toBeVisible();
    await expect(stepper(page).locator("[aria-current='step']")).toContainText("Envío");

    // Same totals as the cart: $2.447 + $299 shipping.
    await expect(page.getByTestId("checkout-shipping")).toHaveText(/299/);
    await expect(page.getByTestId("checkout-total")).toHaveText(/2\.746/);

    await fillShipping(page);
    await page.getByRole("button", { name: /Continuar al pago/ }).click();
    await expect(page.getByRole("heading", { name: "Pago" })).toBeFocused();
    await expect(stepper(page).locator("[aria-current='step']")).toContainText("Pago");
    await expect(stepper(page)).toContainText("Envío (completado)");

    await fillPayment(page);
    await expect(page.getByLabel(/^Número de tarjeta/)).toHaveValue("4242 4242 4242 4242");
    await expect(page.getByTestId("card-brand")).toHaveText("Visa");
    await page.getByRole("button", { name: /Revisar pedido/ }).click();

    await expect(page.getByRole("heading", { name: "Revisa tu pedido" })).toBeFocused();
    await expect(page.getByTestId("review-shipping")).toContainText("Córdoba X5000ABC");
    await expect(page.getByTestId("review-payment")).toContainText("Visa •••• 4242");
    await expect(page.getByTestId("review-total")).toHaveText(/2\.746/);

    await page.getByRole("button", { name: /Confirmar pedido/ }).click();
    await expect(page.getByTestId("place-order")).toHaveAttribute("aria-busy", "true");
    await expect(page.getByTestId("place-order")).toContainText("Procesando");

    const confirmation = page.getByTestId("order-confirmation");
    await expect(confirmation).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "¡Gracias por tu compra!" })).toBeFocused();
    await expect(confirmation.getByTestId("order-id")).toHaveText(/^LEGO-[A-Z0-9]+$/);
    await expect(confirmation).toContainText("ana@example.com");
    await expect(confirmation).toContainText(/2\.746/);

    // The cart is now empty, but the confirmation stays (no redirect to the cart).
    await expect(page.getByTestId("cart-count")).toHaveCount(0);
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(confirmation).toBeVisible();

    await confirmation.getByRole("link", { name: /Seguir comprando/ }).click();
    await expect(page).toHaveURL(/:\d+\/$/);
  });

  test("shipping step: Spanish errors, focus on the first invalid field", async ({ page }) => {
    await page.goto("/checkout");
    await page.getByRole("button", { name: /Continuar al pago/ }).click();
    await expect(page.getByText("Ingresa tu nombre")).toBeVisible();
    await expect(page.getByText("Elige una provincia")).toBeVisible();
    await expect(page.getByLabel(/^Nombre/)).toBeFocused();
    await expect(page.getByLabel(/^Nombre/)).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel(/^Email/).fill("no-es-email");
    await page.getByLabel(/^Código postal/).fill("06600");
    await page.getByLabel(/^Teléfono/).fill("123");
    await page.getByLabel(/^Ciudad/).focus();
    await expect(page.getByText("Ingresa un email válido")).toBeVisible();
    await expect(page.getByText(/formato CPA/)).toBeVisible();
    await expect(page.getByText(/entre 10 y 13 dígitos/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pago" })).toHaveCount(0);
  });

  test("payment step: rejects an invalid card and an expired date; back keeps the address", async ({ page }) => {
    await page.goto("/checkout");
    await fillShipping(page);
    await page.getByRole("button", { name: /Continuar al pago/ }).click();
    await expect(page.getByRole("heading", { name: "Pago" })).toBeFocused();

    await page.getByRole("button", { name: /Revisar pedido/ }).click();
    await expect(page.getByText("Ingresa el número de tarjeta")).toBeVisible();
    await expect(page.getByText("Ingresa el código de seguridad")).toBeVisible();
    await expect(page.getByLabel(/^Número de tarjeta/)).toBeFocused();

    await page.getByLabel(/^Número de tarjeta/).pressSequentially("4242424242424241");
    await page.getByLabel(/^Vencimiento/).pressSequentially("0120");
    await page.getByRole("button", { name: /Revisar pedido/ }).click();
    await expect(page.getByText(/no es una tarjeta válida/)).toBeVisible();
    await expect(page.getByText("La tarjeta está vencida")).toBeVisible();

    await page.getByRole("button", { name: /Volver a envío/ }).click();
    await expect(page.getByRole("heading", { name: "Datos de envío" })).toBeFocused();
    await expect(page.getByLabel(/^Nombre/)).toHaveValue("Ana");
    await expect(page.getByRole("combobox", { name: /Provincia/ })).toContainText("Córdoba");
  });

  test("review step: editing the payment asks for the card again; the full number is never shown", async ({ page }) => {
    await page.goto("/checkout");
    await fillShipping(page);
    await page.getByRole("button", { name: /Continuar al pago/ }).click();
    await fillPayment(page);
    await page.getByRole("button", { name: /Revisar pedido/ }).click();
    await expect(page.getByTestId("review-payment")).toBeVisible();
    await expect(page.locator("main")).not.toContainText("4242 4242 4242 4242");

    await page.getByRole("button", { name: "Editar método de pago" }).click();
    await expect(page.getByRole("heading", { name: "Pago" })).toBeFocused();
    await expect(page.getByLabel(/^Número de tarjeta/)).toHaveValue("");
    await expect(page.getByText("Por seguridad, vuelve a ingresar la tarjeta terminada en 4242.")).toBeVisible();
    await expect(page.getByLabel(/^Nombre en la tarjeta/)).toHaveValue("ANA PEREZ");
    await page.getByRole("button", { name: /Revisar pedido/ }).click();
    await expect(page.getByText("Ingresa el número de tarjeta")).toBeVisible();
  });
});

test("an empty cart redirects from checkout to the cart", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page).toHaveURL(/\/cart$/);
});
