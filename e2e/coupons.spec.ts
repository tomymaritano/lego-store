import { test, expect, type Page } from "@playwright/test";
import { E2E_ADMIN_EMAIL, logIn, uniqueEmail } from "./helpers/accounts";
import { seriousAxeViolations } from "./helpers/axe";
import { clearCheckoutRateLimits, createE2eCoupon, e2eCouponCode, latestOrder, latestOrderCoupon, setE2eCouponActive, setE2eCouponValue } from "./helpers/db";
import { notifyPayment, payPreference } from "./helpers/mercadopago";

/*
 * Coupons against the dev server (Mercado Pago's mock pays): a code applied
 * in the cart's summary, carried into the checkout, validated and reserved
 * by the server and charged with the discount (by card, and through Mercado
 * Pago's own site); the cart and the checkout ask the server again about a
 * stored coupon when they load (an admin's edit or deactivation shows at
 * once); a coupon that stops being valid on the way is removed with the
 * reason; and an admin creates one that a shopper then uses. The specs' coupons (codes starting with E2E) and
 * orders are deleted by the global teardown.
 */

const line = (id: string, name: string, price: number, quantity = 1) => ({ id, name, price, image: "/images/lego.png", quantity, stock: 10 });

/** Real catalogue lines: $2.490 + $799 = $3.289. */
const REAL_CART = [line("7", "Batmobile", 2490), line("20", "Groot Guardians", 799)];

const seedCart = (page: Page, cart: unknown[]) =>
  page.addInitScript((lines) => {
    if (!sessionStorage.getItem("seeded:cart")) {
      localStorage.setItem("lego-cart-storage", JSON.stringify({ state: { cart: lines }, version: 1 }));
      localStorage.removeItem("lego-coupon-storage");
      sessionStorage.setItem("seeded:cart", "1");
    }
  }, cart);

const summary = (page: Page, name: "cart" | "checkout") =>
  page.getByRole("region", { name: "Resumen del pedido" }).filter({ has: page.getByTestId(`${name}-coupon`) });

async function applyCoupon(page: Page, where: "cart" | "checkout", code: string) {
  const box = summary(page, where);
  await box.getByLabel("Código de descuento").fill(code);
  await box.getByRole("button", { name: "Aplicar" }).click();
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

/**
 * Counts the cart's and the checkout's re-checks of the applied coupon, so a
 * spec can wait until the ones in flight have been answered before it
 * changes the coupon behind the shopper's back.
 */
function trackRechecks(page: Page) {
  let sent = 0;
  let answered = 0;
  const isRecheck = (body: string | null) => Boolean(body?.includes('"recheck":true'));
  page.on("request", (request) => {
    if (request.url().endsWith("/api/checkout/coupon") && isRecheck(request.postData())) sent += 1;
  });
  const done = () => (answered += 1);
  page.on("requestfinished", (request) => {
    if (request.url().endsWith("/api/checkout/coupon") && isRecheck(request.postData())) done();
  });
  page.on("requestfailed", (request) => {
    if (request.url().endsWith("/api/checkout/coupon") && isRecheck(request.postData())) done();
  });
  return { settled: () => expect.poll(() => sent > 0 && answered === sent).toBe(true) };
}

const storedCoupon = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("lego-coupon-storage") ?? "{}").state?.coupon ?? null);

/** From the checkout's first step to "Revisar", paying with Mercado Pago's approved test card (or `option`). */
async function toReview(page: Page, email: string, option: RegExp = /Mastercard aprobada en 3 cuotas/) {
  await fillShipping(page, email);
  await page.getByRole("button", { name: /Continuar al pago/ }).click();
  await expect(page.getByTestId("mp-mock-payment")).toBeVisible();
  await page.getByRole("radio", { name: option }).check();
  await page.getByRole("button", { name: /Revisar pedido/ }).click();
  await expect(page.getByRole("heading", { name: "Revisa tu pedido" })).toBeFocused();
}

test.beforeEach(() => clearCheckoutRateLimits());

test.describe("coupons", () => {
  test("applied in the cart, carried into the checkout, paid with the discount", async ({ page }) => {
    test.slow();
    const code = await createE2eCoupon("cart", { type: "PERCENT", value: 10 });
    await seedCart(page, REAL_CART);
    await page.goto("/cart");

    // Typed in lowercase: codes are case-insensitive.
    await applyCoupon(page, "cart", code.toLowerCase());
    const applied = page.getByTestId("cart-coupon-applied");
    await expect(applied).toContainText(code);
    await expect(applied).toContainText("10% de descuento");
    // 10% of $3.289 = $328,90 → $329; shipping stays $299.
    await expect(page.getByTestId("cart-discount")).toHaveText(/329/);
    await expect(page.getByTestId("cart-total")).toHaveText(/3\.259/);
    await expect(page.getByRole("button", { name: `Quitar el cupón ${code}` })).toBeFocused();
    await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

    // It survives a reload and goes with the cart into the checkout.
    await page.reload();
    await expect(page.getByTestId("cart-coupon-applied")).toContainText(code);
    await page.getByTestId("cart-checkout-btn").click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(summary(page, "checkout").getByTestId("checkout-coupon-applied")).toContainText(code);
    await expect(page.getByTestId("checkout-total")).toHaveText(/3\.259/);

    const email = uniqueEmail("coupon-cart");
    await toReview(page, email);
    // The server priced the order with the coupon (and reserved its use).
    await expect(page.getByTestId("review-total")).toHaveText(/3\.259/);
    await expect(page.getByTestId("checkout-discount")).toHaveText(/329/);
    expect(await latestOrderCoupon(email)).toEqual({ couponCode: code, discount: 329, total: 3259, redemption: "RESERVED" });

    await page.getByRole("button", { name: /Realizar pedido/ }).click();
    const confirmation = page.getByTestId("order-confirmation");
    await expect(confirmation).toHaveAttribute("data-status", "PAID", { timeout: 15_000 });
    await expect(confirmation.getByTestId("order-total")).toHaveText(/3\.259/);
    await expect(confirmation.getByTestId("order-discount")).toHaveText(new RegExp(`Ahorraste .*329 con ${code}`));
    expect(await latestOrderCoupon(email)).toEqual({ couponCode: code, discount: 329, total: 3259, redemption: "REDEEMED" });
    // The coupon went with this order: the browser forgets it.
    expect(await storedCoupon(page)).toBeNull();
  });

  test("the cart and the checkout ask the server again about a stored coupon: an edit or a deactivation shows at once", async ({ page }) => {
    test.slow();
    const code = await createE2eCoupon("stale", { type: "FIXED", value: 300 });
    await seedCart(page, REAL_CART);
    await page.goto("/cart");
    await applyCoupon(page, "cart", code);
    await expect(page.getByTestId("cart-discount")).toHaveText(/300/);

    // An admin raises it: the next load shows the new discount, never the stored one.
    await setE2eCouponValue(code, 450);
    await page.reload();
    await expect(page.getByTestId("cart-discount")).toHaveText(/450/);
    await expect(page.getByTestId("cart-total")).toHaveText(/3\.138/);
    await expect(page.getByTestId("cart-discount")).not.toHaveText(/300/);

    // Turned off: the checkout drops it before showing any discount, and says why on the field.
    await setE2eCouponActive(code, false);
    await page.goto("/checkout");
    const box = summary(page, "checkout");
    await expect(box.getByRole("alert")).toHaveText(`Quitamos el cupón ${code}: Este cupón ya no está disponible.`);
    await expect(box.getByLabel("Código de descuento")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByTestId("checkout-discount")).toHaveCount(0);
    await expect(page.getByTestId("checkout-total")).toHaveText(/3\.588/);
    expect(await storedCoupon(page)).toBeNull();
    await expect.poll(() => seriousAxeViolations(page)).toEqual([]);
  });

  test("paid through Mercado Pago's site ('Cuenta de Mercado Pago'): the return page forgets the used coupon", async ({ page }) => {
    test.slow();
    const code = await createE2eCoupon("wallet", { type: "FIXED", value: 200 });
    await seedCart(page, REAL_CART);
    await page.goto("/cart");
    await applyCoupon(page, "cart", code);
    await expect(page.getByTestId("cart-discount")).toHaveText(/200/);
    await page.getByTestId("cart-checkout-btn").click();
    await expect(page).toHaveURL(/\/checkout$/);

    const email = uniqueEmail("coupon-wallet");
    await toReview(page, email, /Cuenta de Mercado Pago/);
    // $3.289 - $200 + $299.
    await expect(page.getByTestId("review-total")).toHaveText(/3\.388/);
    await page.getByRole("button", { name: /Realizar pedido/ }).click();
    await page.waitForURL(/\/checkout\/pedido\/[^/?]+\?preference_id=/, { timeout: 15_000 });
    const preferenceId = new URL(page.url()).searchParams.get("preference_id")!;
    // Not paid yet: the coupon stays applied (the customer may go back and pay another way).
    await expect(page.getByTestId("order-confirmation")).toHaveAttribute("data-status", "PENDING");
    expect((await storedCoupon(page))?.code).toBe(code);

    const paymentId = await payPreference(page.request, preferenceId);
    expect(await notifyPayment(page.request, paymentId)).toBe("paid");
    await expect(page.getByTestId("order-confirmation")).toHaveAttribute("data-status", "PAID", { timeout: 15_000 });
    expect((await latestOrder(email))?.status).toBe("PAID");
    expect(await latestOrderCoupon(email)).toMatchObject({ couponCode: code, discount: 200, redemption: "REDEEMED" });
    // The next purchase starts without it.
    await expect.poll(() => storedCoupon(page)).toBeNull();
  });

  test("a code the server refuses says why; one that stops being valid is removed at checkout with the reason", async ({ page }) => {
    test.slow();
    const rechecks = trackRechecks(page);
    await seedCart(page, REAL_CART);
    await page.goto("/cart");
    await applyCoupon(page, "cart", "E2ENOEXISTE");
    const box = summary(page, "cart");
    await expect(box.getByRole("alert")).toHaveText("Ese código no existe. Revisa que esté bien escrito.");
    await expect(box.getByLabel("Código de descuento")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByTestId("cart-discount")).toHaveCount(0);

    const code = await createE2eCoupon("gone", { type: "FIXED", value: 400 });
    await applyCoupon(page, "cart", code);
    await expect(page.getByTestId("cart-discount")).toHaveText(/400/);
    await page.getByTestId("cart-checkout-btn").click();
    await expect(page).toHaveURL(/\/checkout$/);
    // The checkout asks the server about it as it loads: wait for that answer.
    await rechecks.settled();
    await expect(summary(page, "checkout").getByTestId("checkout-discount")).toHaveText(/400/);

    // The store turns it off while the shopper fills the checkout in.
    await setE2eCouponActive(code, false);
    const email = uniqueEmail("coupon-gone");
    await toReview(page, email);
    await expect(page.getByText(`Quitamos el cupón ${code}: Este cupón ya no está disponible.`)).toBeVisible({ timeout: 15_000 });
    // Priced again without it: $3.289 + $299.
    await expect(page.getByTestId("review-total")).toHaveText(/3\.588/);
    await expect(page.getByTestId("checkout-discount")).toHaveCount(0);
    await expect(summary(page, "checkout").getByLabel("Código de descuento")).toBeVisible();
    expect(await latestOrderCoupon(email)).toEqual({ couponCode: null, discount: 0, total: 3588, redemption: null });
  });

  test("an admin creates a coupon and a shopper uses it", async ({ page, browser }) => {
    test.slow();
    const code = e2eCouponCode("admin");
    // /admin/cupones is the coupons section too.
    await page.goto(`/login?callbackUrl=${encodeURIComponent("/admin/cupones")}`);
    await logIn(page, E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
    await expect(page).toHaveURL(/\/admin\/coupons$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Cupones" })).toBeVisible({ timeout: 30_000 });

    await page.getByRole("link", { name: "Nuevo cupón" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Nuevo cupón" })).toBeVisible({ timeout: 30_000 });
    const form = page.getByRole("form", { name: "Nuevo cupón" });
    const field = (label: string) => form.getByLabel(new RegExp(`^${label}[*]?$`));
    await field("Código").fill(code.toLowerCase());
    await field("Nota interna").fill("Prueba e2e");
    await form.getByRole("radio", { name: /Monto fijo/ }).check();
    // The server validates again: a broken value is refused on its field.
    await field("Monto en pesos").fill("0");
    await page.getByTestId("coupon-save").click();
    await expect(form.getByText("Entre $1 y")).toBeVisible();
    await expect(field("Monto en pesos")).toBeFocused();
    await field("Monto en pesos").fill("500");
    await field("Compra mínima").fill("3000");
    await field("Límite por cliente").fill("1");
    await page.getByTestId("coupon-save").click();

    await expect(page).toHaveURL(/\/admin\/coupons\/[^/?]+/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: code })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(`Creamos el cupón ${code}.`)).toBeVisible();
    await expect(page.getByTestId("coupon-status")).toHaveText("Activo");
    await expect(page.getByTestId("coupon-history")).toContainText("Creó el cupón");
    await expect(page.getByTestId("coupon-history")).toContainText(E2E_ADMIN_EMAIL);
    await expect.poll(() => seriousAxeViolations(page)).toEqual([]);
    const couponPage = page.url();

    // A shopper uses it.
    const context = await browser.newContext();
    const shopper = await context.newPage();
    await seedCart(shopper, REAL_CART);
    await shopper.goto("/cart");
    await applyCoupon(shopper, "cart", code);
    await expect(shopper.getByTestId("cart-coupon-applied")).toContainText("de descuento");
    await expect(shopper.getByTestId("cart-discount")).toHaveText(/500/);
    await expect(shopper.getByTestId("cart-total")).toHaveText(/3\.088/);
    await shopper.getByTestId("cart-checkout-btn").click();
    const email = uniqueEmail("coupon-admin");
    await toReview(shopper, email);
    await expect(shopper.getByTestId("review-total")).toHaveText(/3\.088/);
    await shopper.getByRole("button", { name: /Realizar pedido/ }).click();
    await expect(shopper.getByTestId("order-confirmation")).toHaveAttribute("data-status", "PAID", { timeout: 15_000 });
    await context.close();

    // The admin sees the use, and its money, on the coupon's page and in the list.
    await page.goto(couponPage);
    await expect(page.getByTestId("coupon-uses")).toHaveText("1");
    await expect(page.getByTestId("coupon-discount-given")).toHaveText(/500/);
    await expect(page.getByTestId("coupon-revenue")).toHaveText(/3\.088/);
    await expect(page.getByTestId("coupon-redemption-row")).toHaveCount(1);
    await expect(page.getByTestId("coupon-redemption-row")).toContainText(email);
    await expect(page.getByTestId("coupon-redemption-row")).toContainText("Usado");

    await page.goto(`/admin/coupons?q=${encodeURIComponent(code)}`);
    const row = page.getByTestId("admin-coupon-row").filter({ hasText: code });
    await expect(row).toHaveCount(1);
    await expect(row.getByTestId("admin-coupon-status")).toHaveText("Activo");
    await row.getByRole("button", { name: `Desactivar ${code}` }).click();
    await page.getByRole("dialog", { name: `¿Desactivar ${code}?` }).getByRole("button", { name: "Desactivar" }).click();
    await expect(row.getByTestId("admin-coupon-status")).toHaveText("Desactivado", { timeout: 15_000 });
    await expect.poll(() => seriousAxeViolations(page)).toEqual([]);
  });
});
