import { test, expect, type Frame, type Page } from "@playwright/test";
import Stripe from "stripe";
import { uniqueEmail } from "../helpers/accounts";
import { latestOrder } from "../helpers/db";

/*
 * The real payment path against Stripe TEST mode (playwright.stripe-live.config.ts):
 * Payment Element in the browser -> ConfirmationToken -> the server confirms
 * the PaymentIntent -> handleNextAction for 3DS -> the webhook marks the order
 * PAID with the event Stripe actually recorded.
 *
 * Webhooks: with `stripe listen --forward-to localhost:3200/api/stripe/webhook`
 * running (its whsec_ in STRIPE_WEBHOOK_SECRET), Stripe delivers them itself.
 * Otherwise the spec fetches the real payment_intent.succeeded event from the
 * Stripe API and forwards it, signed with STRIPE_WEBHOOK_SECRET. Either way the
 * payload is Stripe's, not a hand-made one.
 *
 * Skipped unless test keys are configured. Live keys are refused on purpose.
 */

const SECRET = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
const PUBLISHABLE = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
const configured = SECRET.startsWith("sk_test_") && PUBLISHABLE.startsWith("pk_test_") && WEBHOOK_SECRET.startsWith("whsec_");

test.skip(!configured, "Stripe test keys not configured (STRIPE_SECRET_KEY sk_test_, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY pk_test_, STRIPE_WEBHOOK_SECRET)");

const stripe = configured ? new Stripe(SECRET) : null;

/** A real product with plenty of stock (the server reprices it anyway). */
const CART = [{ id: "20", name: "Groot Guardians", price: 799, image: "/images/lego.png", quantity: 1, stock: 10 }];

async function seedCart(page: Page) {
  await page.addInitScript((lines) => {
    if (!sessionStorage.getItem("seeded:cart")) {
      localStorage.setItem("lego-cart-storage", JSON.stringify({ state: { cart: lines }, version: 1 }));
      sessionStorage.setItem("seeded:cart", "1");
    }
  }, CART);
}

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

/** Types a test card into the Payment Element (its card tab is the default). */
async function fillPaymentElement(page: Page, cardNumber: string) {
  const element = page.frameLocator('iframe[title*="pago seguro"], iframe[title*="Secure payment"]').first();
  await element.locator('input[name="number"]').fill(cardNumber, { timeout: 30_000 });
  await element.locator('input[name="expiry"]').fill("12 / 34");
  await element.locator('input[name="cvc"]').fill("123");
  // Some countries ask for a postal code; Argentina does not.
  const postal = element.locator('input[name="postalCode"]');
  if (await postal.isVisible().catch(() => false)) await postal.fill("10001");
}

/** Stripe's 3DS test page sits a few iframes deep: finds the frame with its "Complete" button and clicks it. */
async function completeThreeDSecure(page: Page) {
  let target: Frame | null = null;
  await expect
    .poll(
      async () => {
        for (const frame of page.frames()) {
          const button = frame.getByRole("button", { name: /complete|completar/i });
          if ((await button.count().catch(() => 0)) > 0) {
            target = frame;
            return true;
          }
        }
        return false;
      },
      { timeout: 30_000, message: "the 3DS challenge did not appear" }
    )
    .toBe(true);
  await target!.getByRole("button", { name: /complete|completar/i }).first().click();
}

/** Makes sure our webhook got Stripe's payment_intent.succeeded for this intent (see the top of the file). */
async function deliverRealWebhook(page: Page, intentId: string) {
  let event: Stripe.Event | undefined;
  await expect
    .poll(
      async () => {
        const events = await stripe!.events.list({ type: "payment_intent.succeeded", limit: 20 });
        event = events.data.find((candidate) => (candidate.data.object as { id?: string }).id === intentId);
        return Boolean(event);
      },
      { timeout: 60_000, intervals: [2_000], message: "Stripe has no payment_intent.succeeded for this intent" }
    )
    .toBe(true);
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  const response = await page.request.post("/api/stripe/webhook", {
    data: payload,
    headers: { "content-type": "application/json", "stripe-signature": signature },
  });
  expect(response.status()).toBe(200);
  // "duplicate"/"unchanged": `stripe listen` delivered it first.
  expect(["paid", "duplicate", "unchanged"]).toContain(((await response.json()) as { result: string }).result);
}

async function pay(page: Page, cardNumber: string, { threeDSecure = false } = {}) {
  await seedCart(page);
  const email = uniqueEmail(threeDSecure ? "stripe-3ds" : "stripe-live");
  await page.goto("/checkout");
  await expect(page.locator("[data-payments-mode]")).toHaveAttribute("data-payments-mode", "stripe");
  await fillShipping(page, email);
  await page.getByRole("button", { name: /Continuar al pago/ }).click();
  await expect(page.getByRole("heading", { name: "Pago" })).toBeVisible();

  await fillPaymentElement(page, cardNumber);
  await page.getByRole("button", { name: /Revisar pedido/ }).click();
  await expect(page.getByRole("heading", { name: "Revisa tu pedido" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("review-payment")).toContainText(cardNumber.slice(-4));
  await page.getByRole("button", { name: /Realizar pedido/ }).click();
  if (threeDSecure) await completeThreeDSecure(page);

  const confirmation = page.getByTestId("order-confirmation");
  await expect(confirmation).toBeVisible({ timeout: 60_000 });
  const order = await latestOrder(email);
  expect(order?.paymentIntentId).toMatch(/^pi_/);
  const intent = await stripe!.paymentIntents.retrieve(order!.paymentIntentId!);
  // Stripe charged exactly the server's total (pesos -> centavos).
  expect(intent.status).toBe("succeeded");
  expect(intent.amount_received).toBe(order!.total * 100);

  await deliverRealWebhook(page, intent.id);
  await expect(confirmation.getByTestId("order-status")).toHaveText("Pagado", { timeout: 30_000 });
  expect((await latestOrder(email))?.status).toBe("PAID");
}

test("a guest pays with a real test card through the Payment Element", async ({ page }) => {
  await pay(page, "4242424242424242");
});

test("a 3DS card is authenticated through handleNextAction and paid", async ({ page }) => {
  // Always asks for authentication (https://docs.stripe.com/testing#regulatory-cards).
  await pay(page, "4000002760003184", { threeDSecure: true });
});
