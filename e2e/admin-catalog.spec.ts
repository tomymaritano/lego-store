import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { E2E_ADMIN_EMAIL, field, logIn, PASSWORD } from "./helpers/accounts";
import { createE2eAccount } from "./helpers/db";
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
  // Saving without its alt text is refused on that picture's alt field, which gets the focus.
  await page.getByTestId("product-save").click();
  const addedAlt = added.getByLabel(/^Texto alternativo/);
  await expect(addedAlt).toHaveAttribute("aria-invalid", "true", COLD);
  await expect(addedAlt).toBeFocused();
  await expect(added).toContainText(`La imagen ${before + 1} necesita su texto alternativo`);

  await addedAlt.fill(ALT);
  await expect(addedAlt).not.toHaveAttribute("aria-invalid", "true");
  await added.getByRole("button", { name: /^Hacer principal/ }).click();
  await expect(items.first()).toContainText("Principal");
  // The keyboard stays on the picture: its alt text, now the main one's.
  await expect(items.first().getByLabel(/^Texto alternativo/)).toHaveValue(ALT);
  await expect(items.first().getByLabel(/^Texto alternativo/)).toBeFocused();
  await expect(gallery.getByTestId("gallery-announcement")).toHaveText("Ahora es la imagen principal.");
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

test("the gallery starts from the store's pictures, main one first, and keeps the keyboard on a moved picture", async ({ page }) => {
  // The Batcueva (#10): its main picture is not among its other pictures; the editor must not drop it. Nothing is saved.
  await logInAsAdmin(page, "/admin/products/10");
  await expect(page.getByTestId("product-save")).toBeEnabled(COLD);
  const gallery = page.getByTestId("gallery-editor");
  const items = gallery.getByTestId("gallery-item");
  await expect(items).toHaveCount(3);
  await expect(items.first()).toContainText("76252.png");
  await expect(items.first()).not.toContainText("_alt");

  const second = items.nth(1);
  const url = (await second.locator("p.font-mono").textContent())!;
  await second.getByRole("button", { name: /^Mover antes/ }).focus();
  await page.keyboard.press("Enter");
  // It is first now ("Mover antes" is disabled there): the focus is on its "Mover después".
  await expect(items.first()).toContainText(url);
  await expect(items.first().getByRole("button", { name: /^Mover después/ })).toBeFocused();
  await expect(gallery.getByTestId("gallery-announcement")).toHaveText("Ahora es la imagen principal.");
  await page.keyboard.press("Enter");
  await expect(items.nth(1)).toContainText(url);
  await expect(items.nth(1).getByRole("button", { name: /^Mover después/ })).toBeFocused();
  await expect(gallery.getByTestId("gallery-announcement")).toHaveText("La imagen quedó en el lugar 2 de 3.");
});

test("reordering themes with the keyboard keeps the focus and says the new place", async ({ page }) => {
  await logInAsAdmin(page, "/admin/themes");
  const rows = page.getByTestId("admin-theme-row");
  await expect(rows.first()).toBeVisible(COLD);
  const total = await rows.count();
  const last = rows.nth(total - 1);
  const name = (await last.getByRole("link").first().textContent())!.trim();
  const up = page.getByRole("button", { name: `Subir ${name}`, exact: true });
  const down = page.getByRole("button", { name: `Bajar ${name}`, exact: true });
  await expect(up).toBeEnabled(COLD);
  await up.focus();
  await page.keyboard.press("Enter");
  try {
    await expect(rows.nth(total - 2)).toContainText(name, COLD);
    await expect(up).toBeFocused();
    await expect(rows.nth(total - 2).getByTestId("order-announcement")).toHaveText(`${name} quedó en el lugar ${total - 1} de ${total}`);
  } finally {
    // Back to the end; "Subir" stays usable, "Bajar" is disabled there, so the focus moves to "Subir".
    await down.focus();
    await page.keyboard.press("Enter");
    await expect(rows.nth(total - 1)).toContainText(name, COLD);
  }
  await expect(up).toBeFocused();
  await expect(rows.nth(total - 1).getByTestId("order-announcement")).toHaveText(`${name} quedó en el lugar ${total} de ${total}`);
});

test("an admin blocks a customer: their session ends and logging in again is refused", async ({ page, browser }) => {
  test.slow();
  // The customer, signed in in their own browser.
  const customerContext = await browser.newContext();
  const customer = await customerContext.newPage();
  // Made in the database: the register form's per-IP limit is for the specs about registering.
  const email = await createE2eAccount("blockable", "Cliente Bloqueable");
  await customer.goto("/login?callbackUrl=%2Faccount");
  await logIn(customer, email, PASSWORD);
  // A sign-in (bcrypt, slow on purpose) plus a cold compile of /account, under the parallel workers.
  await expect(customer).toHaveURL(/\/account$/, COLD);

  await logInAsAdmin(page, "/admin/users");
  await page.getByRole("searchbox", { name: "Buscar" }).fill(email);
  await page.getByRole("button", { name: "Filtrar" }).click();
  const row = page.getByTestId("admin-user-row");
  await expect(row).toHaveCount(1, COLD);
  await row.getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Cliente Bloqueable" })).toBeVisible(COLD);
  await expect(page.getByTestId("user-status")).toHaveText("Activa");
  await expect.poll(() => seriousAxeViolations(page)).toEqual([]);
  // The sign-up date stays on one line in the four-column stats, inside its card.
  await page.setViewportSize({ width: 1280, height: 900 });
  const created = page.getByTestId("user-created");
  await expect(created).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/);
  expect(await created.evaluate((el) => el.getClientRects().length)).toBe(1);
  expect(
    await created.evaluate((el) => {
      const card = el.closest("p")!.parentElement!.getBoundingClientRect();
      return el.getBoundingClientRect().right <= card.right + 0.5;
    })
  ).toBe(true);

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
  await expect(customer).toHaveURL(/\/login/, COLD);
  await logIn(customer, email, PASSWORD);
  await expect(customer.getByRole("main").getByText("Tu cuenta está bloqueada", { exact: false })).toBeVisible({ timeout: 15_000 });
  await expect(field(customer, "Email")).toHaveValue(email);
  await customerContext.close();
});
