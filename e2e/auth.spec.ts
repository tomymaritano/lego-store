import { test, expect as baseExpect } from "@playwright/test";
import { seriousAxeViolations } from "./helpers/axe";
import { E2E_ADMIN_EMAIL, PASSWORD, field, logIn, register, signUpFresh, uniqueEmail } from "./helpers/accounts";

/*
 * Accounts end to end, against the dev database: registration, logout,
 * login, the account page, protected routes and the admin role. Accounts
 * are created fresh per test (see helpers/accounts.ts) and removed by the
 * global teardown.
 *
 * Signing up and logging in hash/verify passwords with bcrypt (cost 12, on
 * purpose slow), and parallel workers queue those on one dev server, so
 * assertions after a submit get a longer timeout than the default 5 s.
 */

const expect = baseExpect.configure({ timeout: 15_000 });
test.describe.configure({ timeout: 90_000 });

test.describe("Accounts", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("register -> logout -> login -> account, with the navbar following along", async ({ page }) => {
    const email = uniqueEmail();
    await page.goto("/");
    await page.getByTestId("login-link").click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole("link", { name: "Crea una" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Crea tu cuenta" })).toBeVisible();

    await register(page, { name: "Lucía Bloques", email: email.toUpperCase() });
    await expect(page).toHaveURL(/\/$/);
    const menu = page.getByTestId("account-menu");
    await expect(menu).toHaveAccessibleName("Tu cuenta (Lucía Bloques)");

    // Logout from the account menu.
    await menu.click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page.getByTestId("login-link")).toBeVisible();
    await expect(page.getByTestId("account-menu")).toHaveCount(0);

    // Login again (the email was stored lowercased; any casing works).
    await page.goto("/login");
    await logIn(page, email.toUpperCase());
    await expect(page.getByTestId("account-menu")).toBeVisible();

    await page.goto("/account");
    await expect(page.getByRole("heading", { level: 1, name: "Mi cuenta" })).toBeVisible();
    await expect(page.getByText(email, { exact: true }).first()).toBeVisible();

    // Rename: saved, and the server-rendered navbar picks it up.
    await field(page, "Nombre").fill("Lucía Ladrillos");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Guardamos tu nombre." })).toBeVisible();
    await expect(page.getByTestId("account-menu")).toHaveAccessibleName("Tu cuenta (Lucía Ladrillos)");
    await page.reload();
    await expect(field(page, "Nombre")).toHaveValue("Lucía Ladrillos");
  });

  test("the server HTML already has the signed-in navbar (no flash)", async ({ page, request }) => {
    await signUpFresh(page, "Tomás Piezas");
    const cookies = await page.context().cookies();
    const html = await (
      await request.get("/", { headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") } })
    ).text();
    expect(html).toContain("Tu cuenta (Tomás Piezas)");
    expect(html).not.toContain('data-testid="login-link"');
  });

  test("validation and wrong credentials answer in Spanish, keeping the email", async ({ page }) => {
    await page.goto("/register");
    await register(page, { name: "A", email: "no-es-email", password: "corta" });
    await expect(page.getByText("Ingresa tu nombre (al menos 2 caracteres)")).toBeVisible();
    await expect(page.getByText("Ingresa un email válido")).toBeVisible();
    await expect(page.getByText("La contraseña tiene que tener al menos 8 caracteres")).toBeVisible();
    // Focus goes to the first invalid field.
    await expect(field(page, "Nombre")).toBeFocused();

    await field(page, "Nombre").fill("Ana Prueba");
    await field(page, "Email").fill(uniqueEmail());
    await field(page, "Contraseña").fill(PASSWORD);
    await field(page, "Repite la contraseña").fill(`${PASSWORD}x`);
    await page.getByRole("main").getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Las contraseñas no coinciden")).toBeVisible();

    await page.goto("/login");
    const email = uniqueEmail("nadie");
    await logIn(page, email, "no-es-la-clave");
    await expect(page.getByRole("alert").filter({ hasText: "El email o la contraseña no son correctos." })).toBeVisible();
    await expect(field(page, "Email")).toHaveValue(email);
    await expect(field(page, "Contraseña")).toHaveValue("");
  });

  test("an email that already has an account cannot register again", async ({ page, browser }) => {
    const email = await signUpFresh(page);
    const other = await browser.newPage();
    await other.goto("/register");
    await register(other, { name: "Otra Persona", email });
    await expect(other.getByText("Ya existe una cuenta con ese email.", { exact: false })).toBeVisible();
    await other.close();
  });

  test("a protected page sends visitors to login and back", async ({ page }) => {
    const email = await signUpFresh(page);
    await page.context().clearCookies();

    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Faccount$/);
    await logIn(page, email);
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { level: 1, name: "Mi cuenta" })).toBeVisible();
  });

  test("callbackUrl never leaves the site", async ({ page }) => {
    const email = await signUpFresh(page);
    await page.context().clearCookies();

    await page.goto("/login?callbackUrl=https://evil.example.com/robar");
    await logIn(page, email);
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);

    await page.context().clearCookies();
    await page.goto("/login?callbackUrl=//evil.example.com");
    await logIn(page, email);
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
  });

  test("admin pages: 403 for a customer, open for an admin", async ({ page }) => {
    await signUpFresh(page);
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(403);
    await expect(page.getByRole("heading", { level: 1, name: "No tienes permiso para ver esta página" })).toBeVisible();
    // A customer's menu has no admin link.
    await page.getByTestId("account-menu").click();
    await expect(page.getByRole("link", { name: "Administración" })).toHaveCount(0);

    await page.context().clearCookies();
    await page.goto("/login?callbackUrl=%2Fadmin");
    await logIn(page, E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Panel de administración" })).toBeVisible();
    await page.getByTestId("account-menu").click();
    await expect(page.getByRole("link", { name: "Administración" })).toBeVisible();
  });

  test("changing the password signs out other sessions but keeps this one", async ({ page, browser }) => {
    const email = await signUpFresh(page);
    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await other.goto("/login");
    await logIn(other, email);
    await expect(other.getByTestId("account-menu")).toBeVisible();

    await page.goto("/account");
    await field(page, "Contraseña actual").fill(PASSWORD);
    await field(page, "Nueva contraseña").fill("otra-clave-segura-7");
    await field(page, "Repite la nueva contraseña").fill("otra-clave-segura-7");
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Cambiamos tu contraseña." })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Mi cuenta" })).toBeVisible();
    await other.goto("/account");
    await expect(other).toHaveURL(/\/login\?callbackUrl=%2Faccount$/);
    await otherContext.close();
  });

  test("phones: the menu has the account links", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/item/1");
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const menu = page.getByRole("dialog", { name: "Menú" });
    await expect(menu.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/login?callbackUrl=%2Fitem%2F1");
    await expect(menu.getByRole("link", { name: "Crear cuenta" })).toBeVisible();
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`login, register and account pages pass axe (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      for (const path of ["/login", "/register"]) {
        await page.goto(path);
        await expect.poll(() => seriousAxeViolations(page), { timeout: 15_000 }).toEqual([]);
      }
      await page.getByRole("main").getByRole("button", { name: "Crear cuenta" }).click(); // field errors shown
      await expect.poll(() => seriousAxeViolations(page), { timeout: 15_000 }).toEqual([]);

      await page.goto("/register");
      await register(page, { name: "Axe Prueba", email: uniqueEmail("axe") });
      await expect(page.getByTestId("account-menu")).toBeVisible();
      await page.goto("/account");
      await expect.poll(() => seriousAxeViolations(page), { timeout: 15_000 }).toEqual([]);
      await page.getByTestId("account-menu").click();
      await expect.poll(() => seriousAxeViolations(page), { timeout: 15_000 }).toEqual([]);
    });
  }
});
