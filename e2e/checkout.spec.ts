import { test, expect, type Page } from "@playwright/test";
import { uniqueEmail } from "./helpers/accounts";
import { seriousAxeViolations } from "./helpers/axe";
import { keepSeededCart } from "./helpers/catalog";
import { latestOrder } from "./helpers/db";
import { deliverPaymentSucceeded } from "./helpers/stripe";

/*
 * Checkout against the dev server, which runs with STRIPE_MOCK=1: the payment
 * step offers test cards instead of Stripe's Payment Element, the server
 * prices and creates the order, and the spec delivers the signed
 * payment_intent.succeeded webhook that Stripe would send (helpers/stripe.ts).
 * Purchases buy real products with plenty of stock (7, 20); the global
 * teardown deletes their orders and puts the stock back.
 */

const seedCart = async (page: Page, cart: ReturnType<typeof line>[]) => {
  // Made-up names and prices: keep them when the visitor's cart refreshes from the catalogue.
  await keepSeededCart(page, cart);
  return addCart(page, cart);
};

const addCart = (page: Page, cart: unknown[]) =>
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

async function fillShipping(page: Page, email = "ana@example.com") {
  await page.getByLabel(/^Nombre/).fill("Ana");
  await page.getByLabel(/^Apellido/).fill("Pérez");
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Teléfono/).fill("11 5555 1234");
  await page.getByLabel(/^Dirección/).fill("Av. Corrientes 1234");
  await page.getByLabel(/^Ciudad/).fill("Córdoba");
  await page.getByLabel(/^Código postal/).fill("X5000ABC");
  await page.getByRole("combobox", { name: /Provincia/ }).click();
  await page.getByRole("option", { name: "Córdoba" }).click();
}

/** The mock payment step's test card (Stripe's Payment Element in a configured store). */
async function chooseCard(page: Page, card: RegExp = /Visa aprobada/) {
  await expect(page.getByText(/Modo de prueba/)).toBeVisible();
  await page.getByRole("radio", { name: card }).check();
}

const stepper = (page: Page) => page.getByRole("navigation", { name: "Pasos del checkout" });

/** Real catalogue lines (no patched prices): what the server will charge. */
const REAL_CART = [line("7", "Batmobile", 2490), line("20", "Groot Guardians", 799)];

test.describe("Checkout purchase", () => {
  test("a guest buys: shipping, test card, server-priced review, confirmation until the webhook marks it paid", async ({ page }) => {
    // Several server round trips and a webhook on a busy dev server.
    test.slow();
    await addCart(page, REAL_CART);
    const email = uniqueEmail("guest");
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { level: 1, name: "Finalizar compra" })).toBeVisible();
    await expect(stepper(page).locator("[aria-current='step']")).toContainText("Envío");
    // $2.490 + $799 + $299 shipping.
    await expect(page.getByTestId("checkout-total")).toHaveText(/3\.588/);

    await fillShipping(page, email);
    await page.getByRole("button", { name: /Continuar al pago/ }).click();
    await expect(page.getByRole("heading", { name: "Pago" })).toBeFocused();
    await expect(stepper(page)).toContainText("Envío (completado)");
    // Lighthouse skips /checkout (it redirects without a cart): axe audits every step here.
    await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

    await chooseCard(page);
    await page.getByRole("button", { name: /Revisar pedido/ }).click();
    await expect(page.getByRole("heading", { name: "Revisa tu pedido" })).toBeFocused();
    await expect(page.getByTestId("review-shipping")).toContainText("Córdoba X5000ABC");
    await expect(page.getByTestId("review-payment")).toContainText("Visa •••• 4242");
    // The server priced it and opened the PENDING order.
    await expect(page.getByTestId("review-total")).toHaveText(/3\.588/);
    await expect.poll(async () => (await latestOrder(email))?.status).toBe("PENDING");
    await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

    await page.getByRole("button", { name: /Realizar pedido/ }).click();
    const confirmation = page.getByTestId("order-confirmation");
    await expect(confirmation).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Estamos confirmando tu pago" })).toBeFocused();
    await expect(confirmation.getByTestId("order-status")).toHaveText("Pago pendiente");
    const order = await latestOrder(email);
    await expect(confirmation.getByTestId("order-id")).toHaveText(`LEGO-${String(order!.number).padStart(6, "0")}`);
    // The bought lines left the cart; the confirmation stays (no redirect to the cart).
    await expect(page.getByTestId("cart-count")).toHaveCount(0);
    await expect(page).toHaveURL(/\/checkout$/);

    // Stripe's webhook: the order is paid and the confirmation follows.
    expect((await deliverPaymentSucceeded(page.request, email)).result).toBe("paid");
    await expect(confirmation.getByTestId("order-status")).toHaveText("Pagado", { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: "¡Gracias por tu compra!" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Ruta de navegación" })).toHaveCount(0);
    await expect(confirmation).toContainText(email);
    await expect(confirmation.getByTestId("order-total")).toHaveText(/3\.588/);
    // A guest has no account page for it.
    await expect(confirmation.getByRole("link", { name: /Ver mi pedido/ })).toHaveCount(0);
    await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

    await confirmation.getByRole("link", { name: /Seguir comprando/ }).click();
    await expect(page).toHaveURL(/:\d+\/$/);
  });

  test("a declined card goes back to the payment step with the bank's reason; another card pays", async ({ page }) => {
    test.slow();
    await addCart(page, REAL_CART.slice(1));
    const email = uniqueEmail("declined");
    await page.goto("/checkout");
    await fillShipping(page, email);
    await page.getByRole("button", { name: /Continuar al pago/ }).click();
    await chooseCard(page, /Visa rechazada/);
    await page.getByRole("button", { name: /Revisar pedido/ }).click();
    await expect(page.getByTestId("review-payment")).toContainText("Visa •••• 0002");
    await expect(page.getByTestId("review-total")).toBeVisible();
    await page.getByRole("button", { name: /Realizar pedido/ }).click();

    await expect(page.getByRole("heading", { level: 2, name: "Pago" })).toBeFocused();
    await expect(page.getByRole("region", { name: "Pago" }).getByRole("alert")).toContainText("Tu banco rechazó el pago");
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    expect((await latestOrder(email))?.status).toBe("PENDING");

    await chooseCard(page, /Mastercard aprobada/);
    await page.getByRole("button", { name: /Revisar pedido/ }).click();
    await expect(page.getByTestId("review-payment")).toContainText("Mastercard •••• 4444");
    await expect(page.getByTestId("review-total")).toBeVisible();
    await page.getByRole("button", { name: /Realizar pedido/ }).click();
    await expect(page.getByTestId("order-confirmation")).toBeVisible({ timeout: 15_000 });
  });

  test("placing the order keeps the layout still until the review has faded out", async ({ page }) => {
    test.slow();
    await addCart(page, REAL_CART.slice(0, 1));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/checkout");
    await fillShipping(page, uniqueEmail("layout"));
    await page.getByRole("button", { name: /Continuar al pago/ }).click();
    await chooseCard(page);
    await page.getByRole("button", { name: /Revisar pedido/ }).click();
    await expect(page.getByRole("heading", { name: "Revisa tu pedido" })).toBeFocused();
    await expect(page.getByTestId("review-total")).toBeVisible();

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

    await page.getByRole("button", { name: /Realizar pedido/ }).click();
    await expect(page.getByTestId("order-confirmation")).toBeVisible({ timeout: 15_000 });

    const samples = await page.evaluate(() => (window as unknown as { samples: { width: number; summary: boolean; stepper: boolean }[] }).samples);
    expect(samples.length).toBeGreaterThan(5);
    for (const sample of samples) {
      expect(Math.abs(sample.width - before)).toBeLessThanOrEqual(1);
      expect(sample).toMatchObject({ summary: true, stepper: true });
    }
    // The confirmation enters at the top of the page, its h1 in view.
    const heading = page.getByRole("heading", { level: 1, name: "Estamos confirmando tu pago" });
    await expect(heading).toBeFocused();
    await expect(heading).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe("Checkout", () => {
  test.beforeEach(async ({ page }) => {
    await seedCart(page, [line("1", "Captain Rex Helmet", 899, 2), line("2", "Princess Leia Helmet", 649)]);
  });

  test("shipping step: Spanish errors, focus on the first invalid field", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByTestId("checkout-shipping")).toHaveText(/299/);
    await expect(page.getByTestId("checkout-total")).toHaveText(/2\.746/);
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

  test("payment step: back keeps the address; editing the payment from the review asks for the card again", async ({ page }) => {
    await page.goto("/checkout");
    await fillShipping(page, uniqueEmail("edit"));
    await page.getByRole("button", { name: /Continuar al pago/ }).click();
    await expect(page.getByRole("heading", { name: "Pago" })).toBeFocused();
    await page.getByRole("button", { name: /Volver a envío/ }).click();
    await expect(page.getByRole("heading", { name: "Datos de envío" })).toBeFocused();
    await expect(page.getByLabel(/^Nombre/)).toHaveValue("Ana");
    await expect(page.getByRole("combobox", { name: /Provincia/ })).toContainText("Córdoba");

    await page.getByRole("button", { name: /Continuar al pago/ }).click();
    await chooseCard(page);
    await page.getByRole("button", { name: /Revisar pedido/ }).click();
    await expect(page.getByTestId("review-payment")).toContainText("Visa •••• 4242");
    await page.getByRole("button", { name: "Editar método de pago" }).click();
    await expect(page.getByRole("heading", { name: "Pago" })).toBeFocused();
    await expect(page.getByText("Por seguridad, vuelve a ingresar la tarjeta (Visa •••• 4242).")).toBeVisible();
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
