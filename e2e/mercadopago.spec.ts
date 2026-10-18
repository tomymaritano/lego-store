import { test, expect, type Page } from "@playwright/test";
import { logIn, uniqueEmail } from "./helpers/accounts";
import { seriousAxeViolations } from "./helpers/axe";
import { createE2eAccount, latestOrder } from "./helpers/db";
import { notifyPayment, setLatestPaymentStatus } from "./helpers/mercadopago";

/*
 * The Mercado Pago checkout (the store's default provider) against the dev
 * server, which runs Mercado Pago's mock (PAYMENTS_MOCK=1): the payment step
 * offers test options instead of the Payment Brick, "Realizar pedido" is the
 * only step that charges, and what Mercado Pago does later on its own (a cash
 * ticket paid at the counter) the spec does through the mock and then sends
 * the signed notification (helpers/mercadopago.ts). Real products with
 * plenty of stock (7, 20); the global teardown deletes the orders and puts
 * the stock back.
 */

const line = (id: string, name: string, price: number, quantity = 1) => ({ id, name, price, image: "/images/lego.png", quantity, stock: 10 });

/** Real catalogue lines: what the server will charge. */
const REAL_CART = [line("7", "Batmobile", 2490), line("20", "Groot Guardians", 799)];

const seedCart = (page: Page, cart: unknown[]) =>
  page.addInitScript((lines) => {
    if (!sessionStorage.getItem("seeded:cart")) {
      localStorage.setItem("lego-cart-storage", JSON.stringify({ state: { cart: lines }, version: 1 }));
      sessionStorage.setItem("seeded:cart", "1");
    }
  }, cart);

async function fillShipping(page: Page, email: string) {
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

/** Shipping filled in, on the payment step with Mercado Pago's test options. */
async function toPayment(page: Page, email: string) {
  await page.goto("/checkout");
  await fillShipping(page, email);
  await page.getByRole("button", { name: /Continuar al pago/ }).click();
  await expect(page.getByRole("heading", { name: "Pago" })).toBeFocused();
  await expect(page.getByTestId("mp-mock-payment")).toBeVisible();
}

async function review(page: Page, option: RegExp) {
  await page.getByRole("radio", { name: option }).check();
  await page.getByRole("button", { name: /Revisar pedido/ }).click();
  await expect(page.getByRole("heading", { name: "Revisa tu pedido" })).toBeFocused();
  // $2.490 + $799 + $299 shipping, priced by the server.
  await expect(page.getByTestId("review-total")).toHaveText(/3\.588/);
}

test.describe("Mercado Pago checkout", () => {
  test("an approved card: paid at once, the stock taken, the cart emptied", async ({ page }) => {
    test.slow();
    await seedCart(page, REAL_CART);
    const email = uniqueEmail("mp-card");
    await toPayment(page, email);
    await expect.poll(() => seriousAxeViolations(page)).toEqual([]);
    await review(page, /Mastercard aprobada en 3 cuotas/);
    await expect(page.getByTestId("review-payment")).toContainText("Mastercard •••• 0604");
    await expect(page.getByTestId("review-payment")).toContainText("3 cuotas");
    // Nothing was charged yet: the order is prepared, without a payment.
    expect((await latestOrder(email))?.providerPaymentId).toBeNull();

    await page.getByRole("button", { name: /Realizar pedido/ }).click();
    const confirmation = page.getByTestId("order-confirmation");
    await expect(confirmation).toHaveAttribute("data-status", "PAID", { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: "¡Gracias por tu compra!" })).toBeFocused();
    await expect(confirmation.getByTestId("order-total")).toHaveText(/3\.588/);
    await expect(confirmation).toContainText("Mastercard •••• 0604 · 3 cuotas");
    expect((await latestOrder(email))?.status).toBe("PAID");
    await expect(page.getByTestId("cart-count")).toHaveCount(0);
  });

  test("a rejected card: back to the payment step with the reason; another card pays", async ({ page }) => {
    test.slow();
    await seedCart(page, REAL_CART);
    const email = uniqueEmail("mp-rejected");
    await toPayment(page, email);
    await review(page, /Mastercard sin fondos/);
    await page.getByRole("button", { name: /Realizar pedido/ }).click();

    await expect(page.getByRole("heading", { level: 2, name: "Pago" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("region", { name: "Pago" }).getByRole("alert")).toContainText("La tarjeta no tiene fondos suficientes");
    await expect(page.getByTestId("order-confirmation")).toHaveCount(0);
    expect((await latestOrder(email))?.status).toBe("PENDING");

    await page.getByRole("radio", { name: /Visa aprobada/ }).check();
    await page.getByRole("button", { name: /Revisar pedido/ }).click();
    await page.getByRole("button", { name: /Realizar pedido/ }).click();
    await expect(page.getByTestId("order-confirmation")).toHaveAttribute("data-status", "PAID", { timeout: 15_000 });
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`a cash ticket (${colorScheme}): instructions now, "Mis pedidos" shows them, paid later through the webhook`, async ({ page }) => {
      test.slow();
      await page.emulateMedia({ colorScheme });
      const email = await createE2eAccount(`mp-cash-${colorScheme}`, "Ana Pérez");
      await seedCart(page, REAL_CART);
      await page.goto("/login");
      await logIn(page, email);
      await expect(page.getByTestId("account-menu")).toBeVisible({ timeout: 15_000 });

      await toPayment(page, email);
      await review(page, /Rapipago/);
      await expect(page.getByTestId("review-payment")).toContainText("Rapipago (efectivo)");
      await page.getByRole("button", { name: /Realizar pedido/ }).click();

      const confirmation = page.getByTestId("order-confirmation");
      await expect(confirmation).toHaveAttribute("data-status", "PAYMENT_PENDING", { timeout: 15_000 });
      await expect(page.getByRole("heading", { level: 1, name: "Recibimos tu pedido" })).toBeFocused();
      const instructions = confirmation.getByTestId("pending-payment");
      await expect(instructions).toContainText("en efectivo en Rapipago");
      await expect(instructions.getByTestId("ticket-expiry")).toBeVisible();
      await expect(instructions.getByRole("link", { name: /Ver el ticket de pago/ })).toHaveAttribute("href", /ticket/);
      await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

      const order = (await latestOrder(email))!;
      expect(order.status).toBe("PAYMENT_PENDING");

      // "Mis pedidos" shows what to do.
      await page.goto("/account/orders");
      const card = page.getByTestId("order-card").filter({ hasText: `LEGO-${String(order.number).padStart(6, "0")}` });
      await expect(card.getByTestId("order-card-pending")).toContainText("Paga el ticket en efectivo antes del");
      await page.goto(`/account/orders/${order.id}`);
      await expect(page.getByTestId("order-status")).toHaveText("Esperando el pago");
      await expect(page.getByTestId("pending-payment")).toContainText("Rapipago");
      await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

      // The customer pays at the counter: Mercado Pago approves the payment and notifies us.
      const paid = await setLatestPaymentStatus(page.request, email, "approved", "accredited");
      expect(await notifyPayment(page.request, paid.providerPaymentId!)).toBe("paid");
      // The same notification again changes nothing.
      expect(await notifyPayment(page.request, paid.providerPaymentId!)).toBe("duplicate");
      await page.reload();
      await expect(page.getByTestId("order-status")).toHaveText("Pagado");
      await expect(page.getByTestId("pending-payment")).toHaveCount(0);
    });
  }

  test("the webhook refuses a notification that is not signed with the secret", async ({ request }) => {
    const response = await request.post("/api/webhooks/mercadopago?data.id=123&type=payment", {
      data: JSON.stringify({ type: "payment", data: { id: "123" } }),
      headers: { "content-type": "application/json", "x-signature": "ts=1,v1=00", "x-request-id": "forged" },
    });
    expect(response.status()).toBe(401);
  });
});
