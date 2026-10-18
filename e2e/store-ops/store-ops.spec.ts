import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { logIn, uniqueEmail } from "../helpers/accounts";
import { seriousAxeViolations } from "../helpers/axe";
import { createE2eAccount } from "../helpers/db";

/*
 * The admin's store settings, content and inbox against the dev server and
 * database. This project runs after the chromium and prod ones
 * (playwright.config.ts, dependencies): it changes what every other spec's
 * pages show (the shipping cost, the FAQ), so nothing runs beside it, and
 * each spec puts the store back the way it found it, through the admin.
 * One admin of its own, logged in once: after the whole suite the shared
 * client address is close to the login rate limits.
 */

const COLD = { timeout: 30_000 };

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;
let adminState: StorageState;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login?callbackUrl=%2Fadmin");
  await logIn(page, await createE2eAccount("store-ops", "Admin Tienda", "ADMIN"));
  await expect(page).toHaveURL((url) => url.pathname === "/admin", COLD);
  adminState = await context.storageState();
  await context.close();
});

/** A page signed in as the specs' admin, on `path`. */
async function adminPage(browser: Browser, path: string): Promise<Page> {
  const context = await browser.newContext({ storageState: adminState });
  const page = await context.newPage();
  await page.goto(path);
  await expect(page).toHaveURL((url) => url.pathname === path.split("?")[0], COLD);
  return page;
}

/** Groot Guardians (#20, $799): under any free-shipping threshold the specs use. */
const seedCart = (page: Page) =>
  page.addInitScript(() => {
    if (sessionStorage.getItem("seeded:cart")) return;
    const cart = [{ id: "20", name: "Groot Guardians", price: 799, image: "/images/lego.png", quantity: 1, stock: 10 }];
    localStorage.setItem("lego-cart-storage", JSON.stringify({ state: { cart }, version: 1 }));
    sessionStorage.setItem("seeded:cart", "1");
  });

/** The editor's fields fill reliably once React has hydrated them (a fill before can land in front of the old text). */
const hydratedEditor = (page: Page) => expect(page.getByRole("button", { name: "Pasos o tarjetas", exact: true })).toBeEnabled(COLD);

async function saveShipping(page: Page, cost: string, freeFrom: string) {
  await page.goto("/admin/configuracion");
  await expect(page.getByTestId("settings-shipping-save")).toBeEnabled(COLD);
  const form = page.getByRole("form", { name: "Envío" });
  await form.getByLabel(/^Costo del envío/).fill(cost);
  await form.getByLabel(/^Envío gratis desde/).fill(freeFrom);
  await page.getByTestId("settings-shipping-save").click();
  await expect(page.getByText(/^(Guardamos el envío|No había cambios)/).first()).toBeVisible(COLD);
}

test("an admin changes the shipping cost and the cart charges it", async ({ browser }) => {
  test.slow();
  const page = await adminPage(browser, "/admin/configuracion");
  await expect(page.getByTestId("settings-shipping-save")).toBeEnabled(COLD);
  const form = page.getByRole("form", { name: "Envío" });
  await expect(form.getByLabel(/^Costo del envío/)).toBeVisible(COLD);
  const cost = await form.getByLabel(/^Costo del envío/).inputValue();
  const freeFrom = await form.getByLabel(/^Envío gratis desde/).inputValue();
  await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

  // Invalid values stay on their fields.
  await form.getByLabel(/^Costo del envío/).fill("0");
  await page.getByTestId("settings-shipping-save").click();
  await expect(form.getByLabel(/^Costo del envío/)).toHaveAttribute("aria-invalid", "true", COLD);
  await expect(form.getByLabel(/^Costo del envío/)).toBeFocused();

  try {
    await saveShipping(page, "451", "8000");
    await expect(page.getByText("Guardamos el envío. Los próximos pedidos ya se cobran así.")).toBeVisible();

    // A shopper, in another browser: the cart prices shipping with the new rule.
    const context = await browser.newContext();
    const shopper = await context.newPage();
    await seedCart(shopper);
    await shopper.goto("/cart");
    const summary = shopper.getByRole("region", { name: "Resumen del pedido" });
    await expect(summary.getByTestId("cart-shipping")).toHaveText(/451/, COLD);
    await expect(summary.getByTestId("cart-total")).toHaveText(/1\.250/);
    await expect(summary.getByTestId("free-shipping")).toContainText(/Te faltan\s+\$\s*7\.201/);
    // The announcement bar and the shipping page follow the threshold too.
    await expect(shopper.getByTestId("announcement-bar")).toContainText("8.000");
    await shopper.goto("/envios");
    await expect(shopper.getByRole("main").getByText(/Costo: \$\s*451/)).toBeVisible(COLD);
    await context.close();
  } finally {
    await saveShipping(page, cost, freeFrom);
  }
});

test("an admin edits a FAQ answer, previews it and the page shows it once published", async ({ browser }) => {
  test.slow();
  const marker = `Respuesta de prueba ${Date.now()}`;
  const page = await adminPage(browser, "/admin/contenido/faq");
  await hydratedEditor(page);
  const answer = page.getByLabel("Respuesta 1", { exact: true }).first();
  await expect(answer).toBeVisible(COLD);
  const original = await answer.inputValue();
  await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

  try {
    const edited = `${marker}: con **negrita** y un [enlace](/envios). <script>alert(1)</script>`;
    await answer.fill(edited);
    await expect(answer).toHaveValue(edited);
    await expect(page.getByTestId("content-state")).toHaveText("Cambios sin guardar");

    // The preview is the page's own rendering: Markdown, no raw HTML.
    await page.getByRole("tab", { name: "Vista previa" }).click();
    const preview = page.getByTestId("content-preview");
    await preview.getByText("¿Cómo hago un pedido?").click();
    await expect(preview.getByText(marker)).toBeVisible();
    await expect(preview.locator("strong", { hasText: "negrita" })).toBeVisible();
    await expect(preview.locator("script")).toHaveCount(0);
    await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

    // Not on the store until it is published.
    await page.getByTestId("content-save").click();
    await expect(page.getByText("Guardamos el borrador.", { exact: false })).toBeVisible(COLD);
    await page.goto("/faq");
    await expect(page.getByRole("main")).not.toContainText(marker);

    await page.goto("/admin/contenido/faq");
    await hydratedEditor(page);
    await expect(page.getByTestId("content-state")).toHaveText("Borrador sin publicar", COLD);
    await page.getByTestId("content-publish").click();
    await expect(page.getByText("Publicamos la página. Ya se ve en la tienda.")).toBeVisible(COLD);

    await page.goto("/faq");
    const question = page.getByText("¿Cómo hago un pedido?");
    await question.click();
    await expect(page.getByRole("main").getByText(marker)).toBeVisible(COLD);
    await expect(page.getByRole("main").getByRole("link", { name: "enlace" })).toHaveAttribute("href", "/envios");
  } finally {
    await page.goto("/admin/contenido/faq");
    await hydratedEditor(page);
    const field = page.getByLabel("Respuesta 1", { exact: true }).first();
    await field.fill(original);
    await expect(field).toHaveValue(original);
    await page.getByTestId("content-publish").click();
    await expect(page.getByText(/^(Publicamos la página|La página ya mostraba)/)).toBeVisible(COLD);
  }
});

test("a visitor's contact message reaches the admin's inbox", async ({ browser }) => {
  test.slow();
  const email = uniqueEmail("bandeja");
  const text = `Hola, ¿cuándo llega el set? Mensaje ${Date.now()}.`;
  const context = await browser.newContext();
  const visitor = await context.newPage();
  await visitor.goto("/contacto");
  const main = visitor.getByRole("main");
  await main.getByLabel(/^Nombre/).fill("Ana Bandeja");
  await main.getByLabel(/^Email/).fill(email);
  await main.getByRole("combobox", { name: /Motivo/ }).click();
  await visitor.getByRole("option", { name: "Envíos y entregas" }).click();
  await main.getByLabel(/^Mensaje/).fill(text);
  await main.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(visitor.getByRole("heading", { name: "¡Mensaje enviado!" })).toBeFocused(COLD);
  await context.close();

  const page = await adminPage(browser, "/admin/mensajes");
  await page.getByRole("searchbox", { name: "Buscar" }).fill(email);
  await page.getByRole("button", { name: "Filtrar" }).click();
  const row = page.getByTestId("admin-message-row");
  await expect(row).toHaveCount(1, COLD);
  await expect(row).toContainText("Nuevo");
  await expect(row).toContainText("Envíos y entregas");
  await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

  await row.getByRole("link", { name: "Ana Bandeja" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Mensaje de Ana Bandeja" })).toBeVisible(COLD);
  await expect(page.getByTestId("message-body")).toHaveText(text);
  await expect(page.getByRole("link", { name: "Responder por email" })).toHaveAttribute("href", new RegExp(`^mailto:${email.replace(/[.+]/g, "\\$&")}\\?subject=`));
  await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

  await page.getByRole("button", { name: /^Marcar leído/ }).click();
  await expect(page.getByText("Lo marcamos como leído.")).toBeVisible(COLD);
  await expect(page.getByRole("button", { name: /^No leído/ })).toBeVisible();
  await page.getByRole("button", { name: /^Archivar/ }).click();
  await expect(page.getByRole("button", { name: /^A la bandeja/ })).toBeVisible(COLD);
});
