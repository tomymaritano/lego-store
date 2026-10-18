import { test, expect, type Page } from "@playwright/test";
import { E2E_ADMIN_EMAIL, logIn, uniqueEmail } from "./helpers/accounts";
import { seriousAxeViolations } from "./helpers/axe";
import { keepSeededCart } from "./helpers/catalog";
import { addStock, latestOrder } from "./helpers/db";
import { deliverPaymentSucceeded, useStripeCheckout } from "./helpers/stripe";

/*
 * The admin panel against the dev server and database: an admin edits a
 * product and the storefront shows the change at once (cache tags expired by
 * the Server Action), and an admin ships and delivers an order a guest just
 * paid (mock gateway, webhook delivered by the spec). The product edited is
 * Taj Mahal (#14), which no other spec looks at; the spec puts it back the
 * way it was through the same form. While its form is open a unit is "sold"
 * in the database: saving without touching Stock keeps the sale.
 */

async function logInAsAdmin(page: Page, callbackUrl: string) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await logIn(page, E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
  await expect(page).toHaveURL(new RegExp(`${callbackUrl.replace(/[/?]/g, "\\$&")}$`), COLD);
}

/** Admin routes are not in the global warm-up (they need a session): a cold dev compile under parallel load can take a while. */
const COLD = { timeout: 30_000 };

const field = (page: Page, label: string) => page.getByRole("main").getByLabel(new RegExp(`^${label}[*]?$`));

async function saveProduct(page: Page, price: string, shortDescription: string) {
  await field(page, "Precio").fill(price);
  await field(page, "Descripción corta").fill(shortDescription);
  await page.getByTestId("product-save").click();
  await expect(page.getByText("Guardamos los cambios. Ya se ven en la tienda.")).toBeVisible(COLD);
}

test("an admin edits a product and the store shows it right away", async ({ page }) => {
  test.slow();
  // The storefront before: its current price, read from the page (cached until an edit expires it).
  await page.goto("/item/14");
  await expect(page.getByRole("heading", { level: 1, name: "Taj Mahal" })).toBeVisible();

  await logInAsAdmin(page, "/admin/products");
  await page.getByRole("searchbox", { name: "Buscar" }).fill("taj");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(/q=taj/);
  const row = page.getByTestId("admin-product-row").filter({ hasText: "Taj Mahal" });
  await expect(row).toHaveCount(1, COLD);
  await row.getByRole("link", { name: /^Editar/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Taj Mahal" })).toBeVisible(COLD);
  // Each product's tab has its own title.
  await expect(page).toHaveTitle(/^Taj Mahal · Administración/);

  const price = await field(page, "Precio").inputValue();
  const shortDescription = await field(page, "Descripción corta").inputValue();
  const newPrice = String(Number(price) - 123);
  const stockShown = Number(await field(page, "Stock").inputValue());
  let sold = 0;
  try {
    // The server validates again: a broken value is refused on its field.
    await field(page, "Precio").fill("12.5");
    await page.getByTestId("product-save").click();
    await expect(page.getByText("Tiene que ser un número entero, sin puntos ni signos")).toBeVisible();
    await expect(field(page, "Precio")).toBeFocused();

    // A sale lands while the form is open: saving the rest must not undo it.
    const afterSale = await addStock("14", -1);
    sold = 1;
    expect(afterSale).toBe(stockShown - 1);
    await saveProduct(page, newPrice, "Edición especial del panel de admin.");
    await expect(field(page, "Stock")).toHaveValue(String(afterSale));
    expect(await addStock("14", 0)).toBe(afterSale);
    await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

    // The storefront: product page, search and catalogue cards show the new data.
    await page.goto("/item/14");
    const formatted = new Intl.NumberFormat("es-AR").format(Number(newPrice));
    await expect(page.getByRole("main")).toContainText(formatted);
    await expect(page.getByRole("main")).toContainText("Edición especial del panel de admin.");
    await page.goto("/search?q=taj");
    await expect(page.getByTestId("product-card").filter({ hasText: "Taj Mahal" })).toContainText(formatted);
  } finally {
    if (sold) await addStock("14", sold);
    await page.goto("/admin/products/14");
    await expect(page.getByTestId("product-save")).toBeEnabled(COLD);
    await saveProduct(page, price, shortDescription);
  }
});

test("a picture URL next/image would refuse is only flagged: the new-product form keeps what was typed", async ({ page }) => {
  await logInAsAdmin(page, "/admin/products/new");
  await field(page, "Nombre").fill("Prueba de imagen");
  // A site file with a query string: next/image throws on it (no images.localPatterns), so it is not added.
  await field(page, "O pega una URL").fill("/images/lego.png?v=2");
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByText(/^Sube una imagen, o usa una ruta del sitio/)).toBeVisible();
  await expect(page.getByTestId("gallery-item")).toHaveCount(0);
  await expect(field(page, "Nombre")).toHaveValue("Prueba de imagen");
  await field(page, "O pega una URL").fill("/images/lego.png");
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByRole("img", { name: "Vista previa: Imagen principal" })).toBeVisible();
  // Its alt text is what is missing next: the field has the focus.
  await expect(page.getByLabel(/^Texto alternativo \(imagen principal\)/)).toBeFocused();
});

test("an admin ships and then delivers a paid order", async ({ page, browser, baseURL }) => {
  test.slow();
  // The Stripe checkout (PAYMENT_PROVIDER=stripe); the Mercado Pago one is mercadopago.spec.ts.
  await useStripeCheckout(page.context(), baseURL);
  const email = uniqueEmail("ship");
  // A guest buys the Empire State Building.
  const cart = [{ id: "21", name: "Empire State Building", price: 1299, image: "/images/lego.png", quantity: 1, stock: 10 }];
  await keepSeededCart(page, cart);
  await page.addInitScript((lines) => {
    if (!sessionStorage.getItem("seeded:cart")) {
      localStorage.setItem("lego-cart-storage", JSON.stringify({ state: { cart: lines }, version: 1 }));
      sessionStorage.setItem("seeded:cart", "1");
    }
  }, cart);
  await page.goto("/checkout");
  await page.getByLabel(/^Nombre/).fill("Ana");
  await page.getByLabel(/^Apellido/).fill("Envío");
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Teléfono/).fill("11 5555 1234");
  await page.getByLabel(/^Dirección/).fill("Av. Corrientes 1234");
  await page.getByLabel(/^Ciudad/).fill("Córdoba");
  await page.getByLabel(/^Código postal/).fill("5000");
  await page.getByRole("combobox", { name: /Provincia/ }).click();
  await page.getByRole("option", { name: "Córdoba" }).click();
  await page.getByRole("button", { name: /Continuar al pago/ }).click();
  await page.getByRole("radio", { name: /Visa aprobada/ }).check();
  await page.getByRole("button", { name: /Revisar pedido/ }).click();
  await page.getByRole("button", { name: /Realizar pedido/ }).click();
  await expect(page.getByTestId("order-confirmation")).toBeVisible({ timeout: 15_000 });
  expect((await deliverPaymentSucceeded(page.request, email)).result).toBe("paid");
  const order = (await latestOrder(email))!;
  const number = `LEGO-${String(order.number).padStart(6, "0")}`;

  // The admin, in another browser, finds it among the orders to ship.
  const context = await browser.newContext();
  const admin = await context.newPage();
  await logInAsAdmin(admin, "/admin");
  await admin.getByRole("link", { name: /^Por enviar/ }).click();
  await expect(admin).toHaveURL(/\/admin\/orders\?status=PAID$/, COLD);
  await admin.getByRole("searchbox", { name: "Email o número" }).fill(email);
  await admin.getByRole("button", { name: "Filtrar" }).click();
  await expect(admin.getByTestId("admin-order-row")).toHaveCount(1, COLD);
  await admin.getByRole("link", { name: number }).click();
  await expect(admin.getByRole("heading", { level: 1, name: `Pedido ${number}` })).toBeVisible(COLD);
  await expect(admin).toHaveTitle(new RegExp(`^Pedido ${number} · Administración`));
  await expect(admin.getByTestId("admin-order-status")).toHaveText("Pagado");
  await expect(admin.getByTestId("admin-order-items")).toContainText("Empire State Building");
  await expect(admin.getByText(order.paymentIntentId!)).toBeVisible();
  await expect.poll(() => seriousAxeViolations(admin)).toEqual([]);

  // Ship: a dialog says what happens; cancelling is no longer offered afterwards.
  await admin.getByRole("button", { name: "Marcar como enviado" }).click();
  const dialog = admin.getByRole("dialog", { name: `¿Marcar ${number} como enviado?` });
  await expect(dialog).toContainText(email);
  await expect.poll(() => seriousAxeViolations(admin)).toEqual([]);
  await dialog.getByRole("button", { name: "Marcar como enviado" }).click();
  await expect(admin.getByText("Marcamos el pedido como enviado y le avisamos al cliente por email.")).toBeVisible({ timeout: 15_000 });
  await expect(admin.getByTestId("admin-order-status")).toHaveText("Enviado");
  await expect(admin.getByTestId("admin-order-history")).toContainText(`Pagado → Enviado por ${E2E_ADMIN_EMAIL}`);
  await expect(admin.getByRole("button", { name: /Cancelar/ })).toHaveCount(0);

  await admin.getByRole("button", { name: "Marcar como entregado" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Marcar como entregado" }).click();
  await expect(admin.getByTestId("admin-order-status")).toHaveText("Entregado", { timeout: 15_000 });
  await expect(admin.getByTestId("order-actions")).toHaveCount(0);
  await context.close();

  // The customer's confirmation follows the order.
  expect((await latestOrder(email))!.status).toBe("DELIVERED");
});
