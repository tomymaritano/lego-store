import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { E2E_ADMIN_EMAIL, field, logIn, signUpFresh, PASSWORD } from "./helpers/accounts";
import { seriousAxeViolations } from "./helpers/axe";

/*
 * The admin's catalogue and users sections against the dev server and
 * database: an admin uploads a picture to a product, makes it the main one
 * and the storefront shows it (with its alt text); an admin blocks a
 * customer, whose session ends and whose next login is refused. The product
 * is the Coliseo Romano (#16), which no other spec looks at; the spec takes
 * the uploaded picture out again. Uploaded files stay in public/uploads
 * (gitignored).
 */

const COLD = { timeout: 30_000 };

async function logInAsAdmin(page: Page, callbackUrl: string) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await logIn(page, E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
  await expect(page).toHaveURL((url) => url.pathname === callbackUrl, COLD);
}

const ALT = "El coliseo visto desde arriba, foto de la prueba";

test("an admin uploads a picture to a product, makes it the main one, and the store shows it", async ({ page }) => {
  test.slow();
  await logInAsAdmin(page, "/admin/products/16");
  await expect(page.getByTestId("product-save")).toBeEnabled(COLD);
  const gallery = page.getByTestId("gallery-editor");
  const items = gallery.getByTestId("gallery-item");
  const before = await items.count();

  const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 30, g: 120, b: 200 } } }).png().toBuffer();
  await gallery.getByTestId("image-upload-input").setInputFiles({ name: "coliseo.png", mimeType: "image/png", buffer: png });
  await expect(items).toHaveCount(before + 1, COLD);
  const added = items.last();
  await expect(added).toContainText("/uploads/");
  // Saving without its alt text is refused, naming the picture.
  await page.getByTestId("product-save").click();
  await expect(page.getByTestId("gallery-error")).toContainText(`La imagen ${before + 1} necesita su texto alternativo`);

  await added.getByLabel(/^Texto alternativo/).fill(ALT);
  await added.getByRole("button", { name: /^Hacer principal/ }).click();
  await expect(items.first()).toContainText("Principal");
  await expect(items.first().getByLabel(/^Texto alternativo/)).toHaveValue(ALT);
  try {
    await page.getByTestId("product-save").click();
    await expect(page.getByText("Guardamos los cambios. Ya se ven en la tienda.")).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

    // The storefront: the product page's main picture is the upload, with its alt text.
    await page.goto("/item/16");
    const picture = page.getByRole("main").getByRole("img", { name: ALT }).first();
    await expect(picture).toBeVisible(COLD);
    expect(await picture.getAttribute("src")).toContain(encodeURIComponent("/uploads/"));
    // The card in the catalogue uses it too (the main picture is the card's).
    await page.goto("/search?q=coliseo");
    const card = page.getByTestId("product-card").filter({ hasText: "Coliseo Romano" });
    await expect(card.locator('img[src*="uploads"]').first()).toBeAttached();
  } finally {
    // Back the way it was: the upload out of the gallery.
    await page.goto("/admin/products/16");
    await expect(page.getByTestId("product-save")).toBeEnabled(COLD);
    await page.getByTestId("gallery-item").filter({ hasText: "/uploads/" }).getByRole("button", { name: /^Quitar/ }).click();
    await expect(page.getByTestId("gallery-item")).toHaveCount(before);
    await page.getByTestId("product-save").click();
    await expect(page.getByText("Guardamos los cambios. Ya se ven en la tienda.")).toBeVisible({ timeout: 15_000 });
  }
});

test("an admin blocks a customer: their session ends and logging in again is refused", async ({ page, browser }) => {
  test.slow();
  // The customer, signed in in their own browser.
  const customerContext = await browser.newContext();
  const customer = await customerContext.newPage();
  const email = await signUpFresh(customer, "Cliente Bloqueable");
  await customer.goto("/account");
  await expect(customer).toHaveURL(/\/account$/);

  await logInAsAdmin(page, "/admin/users");
  await page.getByRole("searchbox", { name: "Buscar" }).fill(email);
  await page.getByRole("button", { name: "Filtrar" }).click();
  const row = page.getByTestId("admin-user-row");
  await expect(row).toHaveCount(1, COLD);
  await row.getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Cliente Bloqueable" })).toBeVisible(COLD);
  await expect(page.getByTestId("user-status")).toHaveText("Activa");
  await expect.poll(() => seriousAxeViolations(page)).toEqual([]);

  await page.getByTestId("user-block").click();
  const dialog = page.getByRole("dialog", { name: /Bloquear la cuenta/ });
  await dialog.getByLabel("Motivo").fill("Prueba de bloqueo");
  await dialog.getByRole("button", { name: "Bloquear" }).click();
  await expect(page.getByText(/Bloqueamos la cuenta/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("user-status")).toHaveText("Bloqueada");
  await expect(page.getByTestId("user-blocked")).toContainText("Motivo: Prueba de bloqueo");
  await expect(page.getByTestId("audit-history").first()).toContainText("Bloqueó la cuenta");

  // The customer's session no longer counts: the account page sends them to log in.
  await customer.goto("/account");
  await expect(customer).toHaveURL(/\/login/);
  await logIn(customer, email, PASSWORD);
  await expect(customer.getByRole("main").getByText("Tu cuenta está bloqueada", { exact: false })).toBeVisible({ timeout: 15_000 });
  await expect(field(customer, "Email")).toHaveValue(email);
  await customerContext.close();
});
