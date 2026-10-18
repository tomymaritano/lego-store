import { test, expect, type Page } from "@playwright/test";
import { logIn } from "./helpers/accounts";
import { seriousAxeViolations } from "./helpers/axe";
import { createE2eAccount, latestOrder } from "./helpers/db";
import { deliverPaymentSucceeded } from "./helpers/stripe";

/*
 * A signed-in purchase end to end, against the dev database (payments through
 * the mock gateway, the webhook delivered by the spec, see helpers/stripe.ts):
 * the order is attached to the account, the account's cart loses the bought
 * line, and "Mis pedidos" lists it with its detail page, which nobody else
 * can open.
 */

const seedGuestCart = (page: Page, lines: unknown[]) =>
  page.addInitScript((cart) => {
    if (sessionStorage.getItem("seeded")) return;
    localStorage.setItem("lego-cart-storage", JSON.stringify({ state: { cart }, version: 1 }));
    sessionStorage.setItem("seeded", "1");
  }, lines);

async function fillShipping(page: Page, email: string) {
  await page.getByLabel(/^Nombre/).fill("Bruno");
  await page.getByLabel(/^Apellido/).fill("Díaz");
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Teléfono/).fill("351 555 1234");
  await page.getByLabel(/^Dirección/).fill("Bv. San Juan 500");
  await page.getByLabel(/^Ciudad/).fill("Córdoba");
  await page.getByLabel(/^Código postal/).fill("5000");
  await page.getByRole("combobox", { name: /Provincia/ }).click();
  await page.getByRole("option", { name: "Córdoba" }).click();
}

test("a signed-in customer buys, and follows the order in Mis pedidos (only theirs)", async ({ page, browser }) => {
  // Two logins (bcrypt), checkout round trips and a second browser.
  test.slow();
  const email = await createE2eAccount("buyer", "Bruno Díaz");
  // Groot Guardians ($799) in the guest cart: merged into the account on login.
  await seedGuestCart(page, [{ id: "20", name: "Groot Guardians", price: 799, image: "/images/lego.png", quantity: 2, stock: 10 }]);
  await page.goto("/login");
  await logIn(page, email);
  await expect(page.getByTestId("account-menu")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("cart-count")).toHaveText("2");

  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Mis pedidos" })).toBeVisible();
  await expect(page.getByText("Todavía no hiciste pedidos.")).toBeVisible();

  await page.goto("/checkout");
  await fillShipping(page, email);
  await page.getByRole("button", { name: /Continuar al pago/ }).click();
  await page.getByRole("radio", { name: /Visa aprobada/ }).check();
  await page.getByRole("button", { name: /Revisar pedido/ }).click();
  // 2 × $799 + $299.
  await expect(page.getByTestId("review-total")).toHaveText(/1\.897/);
  await page.getByRole("button", { name: /Realizar pedido/ }).click();
  const confirmation = page.getByTestId("order-confirmation");
  await expect(confirmation).toBeVisible({ timeout: 15_000 });
  expect((await deliverPaymentSucceeded(page.request, email)).result).toBe("paid");
  await expect(confirmation.getByTestId("order-status")).toHaveText("Pagado", { timeout: 15_000 });
  const order = (await latestOrder(email))!;
  const number = `LEGO-${String(order.number).padStart(6, "0")}`;

  // The account's cart lost the line on the server too.
  await expect(page.getByTestId("cart-count")).toHaveCount(0);
  const lists = (await (await page.request.get("/api/lists")).json()) as { cart: unknown[] };
  expect(lists.cart).toEqual([]);

  // The confirmation links to the order in the account.
  await confirmation.getByRole("link", { name: /Ver mi pedido/ }).click();
  await expect(page).toHaveURL(new RegExp(`/account/orders/${order.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: `Pedido ${number}` })).toBeVisible();
  await expect(page.getByTestId("order-status")).toHaveText("Pagado");
  const timeline = page.getByTestId("order-timeline");
  await expect(timeline.getByRole("listitem")).toHaveText([/Pedido realizado/, /Pago confirmado/, /Enviado/, /Entregado/]);
  await expect(timeline.locator("[aria-current='step']")).toContainText("Pago confirmado");
  await expect(page.getByTestId("order-items")).toContainText("Groot Guardians");
  await expect(page.getByTestId("order-items")).toContainText("2 ×");
  await expect(page.getByTestId("order-total")).toHaveText(/1\.897/);
  await expect(page.getByText("Visa •••• 4242")).toBeVisible();
  await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

  // Listed in Mis pedidos, and on /account.
  await page.getByRole("navigation", { name: "Ruta de navegación" }).getByRole("link", { name: "Mis pedidos" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Mis pedidos" })).toBeVisible();
  const card = page.getByTestId("order-card").filter({ hasText: number });
  await expect(card).toContainText("Pagado");
  await expect(card).toContainText("Groot Guardians");
  await expect.poll(() => seriousAxeViolations(page)).toEqual([]);
  await page.goto("/account");
  await expect(page.getByTestId("order-card").filter({ hasText: number })).toBeVisible();

  // Someone else signed in gets a 404 for it; a visitor is sent to log in.
  const other = await browser.newContext();
  const stranger = await other.newPage();
  await stranger.goto("/login");
  await logIn(stranger, await createE2eAccount("stranger", "Otra Persona"));
  await expect(stranger.getByTestId("account-menu")).toBeVisible({ timeout: 15_000 });
  const response = await stranger.goto(`/account/orders/${order.id}`);
  expect(response?.status()).toBe(404);
  await expect(stranger.getByRole("heading", { level: 1, name: "Esta pieza no está en la caja" })).toBeVisible();
  expect((await stranger.request.get(`/api/checkout/orders/${order.id}`)).status()).toBe(404);
  await other.close();

  const visitor = await browser.newContext();
  const anonymous = await visitor.newPage();
  await anonymous.goto(`/account/orders/${order.id}`);
  await expect(anonymous).toHaveURL(/\/login\?callbackUrl=/);
  await visitor.close();
});
