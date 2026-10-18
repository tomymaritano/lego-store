import { test, expect, type Page } from "@playwright/test";
import { register, signUpFresh, uniqueEmail } from "./helpers/accounts";
import { seriousAxeViolations } from "./helpers/axe";
import { countHelpfulVotes, countReviews } from "./helpers/db";

/*
 * Reviews end to end, against the dev database: visitors are sent to log in,
 * a signed-in user publishes, edits and deletes their review (one per
 * product), and marks other reviews "útil" (a toggle that survives a reload).
 * Each test uses its own product so parallel workers never move each other's
 * counts, and each one deletes what it wrote (the global teardown also removes
 * the e2e accounts, and with them their reviews).
 */

const reviewsRegion = (page: Page) => page.getByRole("region", { name: "Reseñas de clientes" });
const reviewsLink = (page: Page) => page.getByRole("link", { name: /^Ver \d+ reseñas?$/ });

/**
 * The product the publish/edit/delete flow writes to. No other spec opens its
 * page: a render of it running in parallel (another worker) could read the
 * reviews just before a write and store them in the data cache just after,
 * and this test would see that copy.
 */
const PRODUCT = "8";

const reviewCountLabel = (n: number) => (n === 1 ? "Ver 1 reseña" : `Ver ${n} reseñas`);

/** The radios are visually hidden; the visible star is their label. */
const pickStars = (page: Page, label: string) => page.getByRole("radio", { name: label }).locator("..").click();

test.describe("Reviews", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("a visitor logs in to review, then publishes, edits and deletes their review", async ({ page }) => {
    // A sign-up (bcrypt, slow on purpose) and a dozen round trips.
    test.slow();
    const published = await countReviews(PRODUCT);
    await page.goto(`/item/${PRODUCT}`);
    await page.waitForLoadState("networkidle");
    await reviewsLink(page).click();

    // Signed out: "Escribir reseña" leads to login, and back to the form afterwards.
    await expect(reviewsRegion(page).getByText("Inicia sesión para opinar")).toBeVisible();
    await reviewsRegion(page).getByRole("link", { name: "Escribir reseña" }).click();
    await expect(page).toHaveURL(new RegExp(`/login\\?callbackUrl=%2Fitem%2F${PRODUCT}%23escribir-resena$`), { timeout: 15_000 });
    await page.getByRole("link", { name: "Crea una" }).click();
    await register(page, { name: "Reseñista E2E", email: uniqueEmail("review") });
    await expect(page.getByTestId("account-menu")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(new RegExp(`/item/${PRODUCT}`), { timeout: 15_000 });

    // The form opens (from the link's fragment) and validates in Spanish.
    const toggle = reviewsRegion(page).getByRole("button", { name: /^(Escribir reseña|Cancelar)$/ });
    if ((await toggle.textContent()) !== "Cancelar") await toggle.click();
    await expect(page.getByText("Se publica como")).toContainText("Reseñista E2E");
    await expect.poll(() => seriousAxeViolations(page)).toEqual([]);
    await page.getByRole("button", { name: "Publicar reseña" }).click();
    await expect(page.getByText("Elige una calificación de 1 a 5 estrellas")).toBeVisible();
    await expect(page.getByText("Escribe un título (al menos 3 caracteres)")).toBeVisible();
    await expect(page.getByRole("radio", { name: "1 estrella" })).toBeFocused();

    await pickStars(page, "5 estrellas");
    await page.getByLabel("Título").fill("Precioso en la repisa");
    await page.getByLabel("Tu reseña").fill("Se arma rápido y queda espectacular.");
    await page.getByRole("button", { name: "Publicar reseña" }).click();

    // Published: first in the list, marked as theirs, and the page re-rendered with the new count.
    const own = reviewsRegion(page).getByTestId("review").filter({ hasText: "Precioso en la repisa" });
    await expect(own).toBeVisible();
    await expect(own.getByText("Tu reseña")).toBeVisible();
    await expect(reviewsLink(page)).toHaveText(reviewCountLabel(published + 1));
    await expect(page.getByRole("tab", { name: /Reseñas/ })).toContainText(String(published + 1));

    // One per product: the button now edits it.
    await reviewsRegion(page).getByRole("button", { name: "Editar tu reseña" }).click();
    await expect(page.getByLabel("Título")).toHaveValue("Precioso en la repisa");
    await page.getByLabel("Título").fill("Aún mejor de lo que esperaba");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(reviewsRegion(page).getByRole("heading", { level: 3, name: "Aún mejor de lo que esperaba" })).toBeVisible();

    // It survives a reload (it is in the database, not in this browser).
    await page.reload();
    await page.getByRole("tab", { name: /Reseñas/ }).click();
    const saved = reviewsRegion(page).getByTestId("review").filter({ hasText: "Aún mejor de lo que esperaba" });
    await expect(saved.getByText("Tu reseña")).toBeVisible();

    // Delete it (confirmed in a dialog): the count goes back.
    await saved.getByRole("button", { name: "Eliminar" }).click();
    const dialog = page.getByRole("dialog", { name: "¿Eliminar tu reseña?" });
    await expect(dialog).toBeVisible();
    await expect.poll(() => seriousAxeViolations(page)).toEqual([]);
    await dialog.getByRole("button", { name: "Eliminar reseña" }).click();
    // The dialog stays open (the rest of the page hidden from the accessibility tree) until
    // the Server Action answers, which can take seconds while every worker hits the dev server.
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(saved).toHaveCount(0);
    await expect(reviewsLink(page)).toHaveText(reviewCountLabel(published));
  });

  test("'útil' counts once per user, can be taken back, and is stored on the server", async ({ page }) => {
    await signUpFresh(page, "Votante E2E");
    await page.goto("/item/13");
    await page.getByRole("tab", { name: /Reseñas/ }).click();
    const first = reviewsRegion(page).getByTestId("review").first();
    const reviewId = (await first.getAttribute("data-review-id"))!;
    const vote = first.getByRole("button", { name: /^Útil/ });
    await expect(vote).toHaveAttribute("aria-disabled", "false");
    const before = await countHelpfulVotes(reviewId);

    // The vote shows at once; the Server Action (a POST to this page) saves it.
    const saved = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/item/13"));
    await vote.click();
    await expect(vote).toHaveAttribute("aria-pressed", "true");
    await expect(vote).toHaveText(`Útil (${before + 1})`);
    await saved;
    expect(await countHelpfulVotes(reviewId)).toBe(before + 1);

    await page.reload();
    await page.getByRole("tab", { name: /Reseñas/ }).click();
    const again = reviewsRegion(page).locator(`[data-review-id="${reviewId}"]`).getByRole("button", { name: /^Útil/ });
    await expect(again).toHaveAttribute("aria-pressed", "true");
    await expect(again).toHaveText(`Útil (${before + 1})`);

    const undone = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/item/13"));
    await again.click();
    await expect(again).toHaveAttribute("aria-pressed", "false");
    await expect(again).toHaveText(`Útil (${before})`);
    await undone;
    expect(await countHelpfulVotes(reviewId)).toBe(before);
  });

  test("the list is sorted and paged on the server", async ({ page }) => {
    await page.goto("/item/11");
    await page.getByRole("tab", { name: /Reseñas/ }).click();
    const items = reviewsRegion(page).getByTestId("review");
    await expect(items).toHaveCount(5);
    await reviewsRegion(page).getByRole("button", { name: "Ver más reseñas" }).focus();
    await page.keyboard.press("Enter");
    await expect(items).toHaveCount(await countReviews("11"));
    // Focus moves to the first review loaded (the button may be gone), never to <body>.
    await expect(items.nth(5)).toBeFocused();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);

    await reviewsRegion(page).getByRole("combobox", { name: "Ordenar reseñas" }).click();
    await page.getByRole("option", { name: "Peor valoradas" }).click();
    await expect(items).toHaveCount(5);
    const stars = await items.evaluateAll((nodes) =>
      nodes.map((node) => Number(node.querySelector("[aria-label^='Valoración']")!.getAttribute("aria-label")!.match(/[\d,]+/)![0]))
    );
    expect([...stars].sort((a, b) => a - b)).toEqual(stars);
  });

  test("an invalid submit shows the focused rating group below the sticky header", async ({ page }) => {
    await signUpFresh(page, "Móvil E2E");
    await page.setViewportSize({ width: 390, height: 600 });
    await page.goto("/item/1");
    await page.waitForLoadState("networkidle");
    await reviewsLink(page).click();
    await reviewsRegion(page).getByRole("button", { name: "Escribir reseña" }).click();
    await page.getByRole("button", { name: "Publicar reseña" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("radio", { name: "1 estrella" })).toBeFocused();

    const headerBottom = await page.locator("[data-site-header]").evaluate((el) => el.getBoundingClientRect().bottom);
    const group = page.getByRole("radiogroup", { name: /Tu calificación/ });
    await expect
      .poll(() => group.evaluate((el) => el.querySelector("legend")!.getBoundingClientRect().top))
      .toBeGreaterThanOrEqual(headerBottom);
    await expect(page.getByText("Elige una calificación de 1 a 5 estrellas")).toBeInViewport();
  });
});
