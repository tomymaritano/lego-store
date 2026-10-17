import { test, expect, type Page } from "@playwright/test";
import { seriousAxeViolations } from "./helpers/axe";

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

    // Lighthouse skips /checkout (it redirects without a cart): axe audits every step here,
    // polling because a step that just slid in is still fading (axe reads that as low contrast).
    await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

    await fillPayment(page);
    await expect(page.getByLabel(/^Número de tarjeta/)).toHaveValue("4242 4242 4242 4242");
    await expect(page.getByTestId("card-brand")).toHaveText("Visa");
    await page.getByRole("button", { name: /Revisar pedido/ }).click();

    await expect(page.getByRole("heading", { name: "Revisa tu pedido" })).toBeFocused();
    await expect(page.getByTestId("review-shipping")).toContainText("Córdoba X5000ABC");
    await expect(page.getByTestId("review-payment")).toContainText("Visa •••• 4242");
    await expect(page.getByTestId("review-total")).toHaveText(/2\.746/);
    await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

    await page.getByRole("button", { name: /Confirmar pedido/ }).click();
    await expect(page.getByTestId("place-order")).toHaveAttribute("aria-busy", "true");
    await expect(page.getByTestId("place-order")).toContainText("Procesando");

    const confirmation = page.getByTestId("order-confirmation");
    await expect(confirmation).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { level: 1, name: "¡Gracias por tu compra!" })).toBeFocused();
    // The purchase is finished: no "Finalizar compra" heading or checkout breadcrumb above it.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Finalizar compra" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Ruta de navegación" })).toHaveCount(0);
    await expect(confirmation.getByTestId("order-id")).toHaveText(/^LEGO-[A-Z0-9]+$/);
    await expect(confirmation).toContainText("ana@example.com");
    await expect(confirmation).toContainText(/2\.746/);
    await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

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
  test("phones show the order summary once, collapsed above the form", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/checkout");
    await expect(page.getByRole("region", { name: "Resumen del pedido" })).toBeHidden();
    const summary = page.locator("summary", { hasText: "Ver resumen" });
    await expect(summary).toContainText("2.746");
    await summary.click();
    await expect(page.getByTestId("checkout-mobile-total")).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole("region", { name: "Resumen del pedido" })).toBeVisible();
    await expect(summary).toBeHidden();
  });

  test("placing the order keeps the layout still until the review has faded out", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/checkout");
    await fillShipping(page);
    await page.getByRole("button", { name: /Continuar al pago/ }).click();
    await fillPayment(page);
    await page.getByRole("button", { name: /Revisar pedido/ }).click();
    await expect(page.getByRole("heading", { name: "Revisa tu pedido" })).toBeFocused();

    // Sample every frame from the click until the confirmation shows up.
    await page.evaluate(() => {
      const samples: { width: number; summary: boolean; stepper: boolean }[] = [];
      (window as unknown as { samples: typeof samples }).samples = samples;
      const tick = () => {
        const review = document.querySelector("section[aria-labelledby='review-title']");
        if (review) {
          samples.push({
            width: review.getBoundingClientRect().width,
            summary: !!document.querySelector("[aria-labelledby='checkout-summary-title']"),
            stepper: !!document.querySelector("nav[aria-label='Pasos del checkout']"),
          });
        }
        if (!document.querySelector("[data-testid='order-confirmation']")) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const before = await page.locator("section[aria-labelledby='review-title']").evaluate((el) => el.getBoundingClientRect().width);

    await page.getByRole("button", { name: /Confirmar pedido/ }).click();
    await expect(page.getByTestId("order-confirmation")).toBeVisible({ timeout: 10_000 });

    const samples = await page.evaluate(() => (window as unknown as { samples: { width: number; summary: boolean; stepper: boolean }[] }).samples);
    expect(samples.length).toBeGreaterThan(10);
    for (const sample of samples) {
      expect(Math.abs(sample.width - before)).toBeLessThanOrEqual(1);
      expect(sample).toMatchObject({ summary: true, stepper: true });
    }
    // The confirmation enters at the top of the page, its h1 in view.
    await expect(page.getByRole("heading", { level: 1, name: "¡Gracias por tu compra!" })).toBeFocused();
    await expect(page.getByRole("heading", { level: 1, name: "¡Gracias por tu compra!" })).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("leaving while the payment runs cancels the order and keeps the cart", async ({ page }) => {
    await page.goto("/checkout");
    await fillShipping(page);
    await page.getByRole("button", { name: /Continuar al pago/ }).click();
    await fillPayment(page);
    await page.getByRole("button", { name: /Revisar pedido/ }).click();
    await page.getByRole("button", { name: /Confirmar pedido/ }).click();
    await expect(page.getByTestId("place-order")).toHaveAttribute("aria-busy", "true");

    await page.getByRole("navigation", { name: "Ruta de navegación" }).getByRole("link", { name: "Carrito" }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText(/Cancelamos el pago porque saliste del checkout/)).toBeVisible();
    // Past the mock payment's delay: still no order, the cart is intact.
    await page.waitForTimeout(1_500);
    await expect(page.getByText("Tu carrito está vacío")).toHaveCount(0);
    await expect(page.getByTestId("cart-count")).toHaveText("3");

    await page.goBack();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole("heading", { level: 1, name: "Finalizar compra" })).toBeVisible();
    await expect(page.getByTestId("order-confirmation")).toHaveCount(0);
  });
});

test.describe("Checkout summary with a long cart", () => {
  test.beforeEach(async ({ page }) => {
    await seedCart(
      page,
      Array.from({ length: 6 }, (_, i) => line(String(i + 1), `Set de prueba ${i + 1}`, 1000 + i * 100, i === 0 ? 2 : 1))
    );
  });

  test("the scrolling line list is keyboard reachable, badges are not clipped, and axe passes", async ({ page }) => {
    await page.goto("/checkout");
    const list = page.getByTestId("checkout-lines");
    await expect(page.getByTestId("checkout-line")).toHaveCount(6);

    // Scrollable, so it is a named tab stop that the keyboard can scroll.
    await expect(list).toHaveAttribute("tabindex", "0");
    await expect(list).toHaveAccessibleName("Productos del pedido");
    await list.focus();
    await page.keyboard.press("End");
    await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    // The first quantity badge sits fully inside the scroll container.
    const clipped = await list.evaluate((el) => {
      el.scrollTo({ top: 0, behavior: "instant" });
      const badge = el.querySelector("[data-testid='checkout-line'] .rounded-full")!;
      const listTop = el.getBoundingClientRect().top;
      const badgeTop = badge.getBoundingClientRect().top;
      return listTop - badgeTop;
    });
    expect(clipped).toBeLessThanOrEqual(0);

    expect(await seriousAxeViolations(page)).toEqual([]);

    // Validation errors on the shipping step do not add violations either.
    await page.getByRole("button", { name: /Continuar al pago/ }).click();
    await expect(page.getByText("Ingresa tu nombre")).toBeVisible();
    expect(await seriousAxeViolations(page)).toEqual([]);
  });
});

test("a short summary list that does not scroll is not a tab stop", async ({ page }) => {
  await seedCart(page, [line("1", "Captain Rex Helmet", 899)]);
  await page.goto("/checkout");
  await expect(page.getByTestId("checkout-line")).toHaveCount(1);
  await expect(page.getByTestId("checkout-lines")).not.toHaveAttribute("tabindex");
});

test("an empty cart redirects from checkout to the cart", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page).toHaveURL(/\/cart$/);
});
