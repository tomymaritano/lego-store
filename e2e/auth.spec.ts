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
    // The browser is now a known device for this account (its logins skip the shared limits).
    const knownDevice = (await page.context().cookies()).find((cookie) => cookie.name === "known-device");
    expect(knownDevice).toMatchObject({ httpOnly: true, sameSite: "Lax" });

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

  test("a signed-in visit to /login or /register never bounces to another site", async ({ page }) => {
    await signUpFresh(page);
    // Dot segments parse into a protocol-relative "//evil.example/phish" if only the raw value is checked.
    for (const path of ["/login", "/register"]) {
      for (const callback of ["/.//evil.example/phish", "/%2e//evil.example/phish", "/a/..//evil.example/phish"]) {
        const response = await page.request.get(`${path}?callbackUrl=${encodeURIComponent(callback)}`, { maxRedirects: 0 });
        expect(response.status(), `${path} ${callback}`).toBe(307);
        expect(response.headers().location, `${path} ${callback}`).toBe("/");
      }
    }
    await page.goto(`/login?callbackUrl=${encodeURIComponent("/.//evil.example/phish")}`);
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
  });

  test("logging out sticks, even when an /account request answers after it", async ({ page }) => {
    await signUpFresh(page);

    // proxy.ts reads the session cookie but never re-issues it (Auth.js's wrapper would, on every request).
    const direct = await page.request.get("/account", { headers: { RSC: "1", "Next-Router-Prefetch": "1" } });
    const sessionCookies = direct.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie" && h.value.includes("session-token"));
    expect(sessionCookies).toEqual([]);

    // An /account request (a prefetch, say) that leaves before logout and answers after it.
    let release!: () => void;
    const loggedOut = new Promise<void>((resolve) => (release = resolve));
    const accountUrl = /\/account(\?|$)/;
    await page.route(accountUrl, async (route) => {
      const response = await route.fetch();
      await loggedOut;
      await route.fulfill({ response });
    });
    const inFlight = page.evaluate(() => fetch("/account", { headers: { RSC: "1", "Next-Router-Prefetch": "1" } }).then((r) => r.status));

    await page.getByTestId("account-menu").click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page.getByTestId("login-link")).toBeVisible();
    release();
    await inFlight;
    await page.unroute(accountUrl);

    await page.goto("/login");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Inicia sesión" })).toBeVisible();
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Faccount$/);
  });

  test("admin pages: 403 for a customer, open for an admin", async ({ page }) => {
    await signUpFresh(page);
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      // The 403 status itself is logged as a failed resource; anything else is a real problem.
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) consoleErrors.push(message.text());
    });
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(403);
    await expect(page.getByRole("heading", { level: 1, name: "No tienes permiso para ver esta página" })).toBeVisible();
    // The 403 is rendered from Next's error shell (the whole tree renders on the client): no React warnings.
    await expect(page.getByTestId("account-menu")).toBeEnabled();
    expect(consoleErrors).toEqual([]);
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

    await expect(page).toHaveURL(/\/account$/);

    // The confirmation is a one-time flash: gone on reload, and no link can fake it.
    await expect
      .poll(async () => (await page.context().cookies()).some((cookie) => cookie.name === "password-changed"))
      .toBe(false);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Mi cuenta" })).toBeVisible();
    await expect(page.getByText("Cambiamos tu contraseña.", { exact: false })).toHaveCount(0);
    await page.goto("/account?password-changed=1");
    await expect(page.getByRole("heading", { level: 1, name: "Mi cuenta" })).toBeVisible();
    await expect(page.getByText("Cambiamos tu contraseña.", { exact: false })).toHaveCount(0);

    // The signed-out device asks Auth.js to refresh its token (any client may call this
    // endpoint): the revoked session must stay revoked.
    const refresh = await other.evaluate(async () => {
      const { csrfToken } = (await (await fetch("/api/auth/csrf")).json()) as { csrfToken: string };
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csrfToken, data: {} }),
      });
      return response.json() as Promise<{ sessionVersion?: number } | null>;
    });
    expect(refresh?.sessionVersion).toBeUndefined();

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

  test("phones: a customer's menu shows the account and logs out", async ({ page }) => {
    await signUpFresh(page, "Marta Móvil");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/item/1");
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const menu = page.getByRole("dialog", { name: "Menú" });
    await expect(menu.getByText("Marta Móvil", { exact: true })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Mi cuenta" })).toHaveAttribute("href", "/account");
    await expect(menu.getByRole("link", { name: "Administración" })).toHaveCount(0);
    await expect(menu.getByRole("link", { name: "Iniciar sesión" })).toHaveCount(0);

    await menu.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
    await expect(menu).toBeHidden(); // closes once signed out
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await expect(page.getByRole("dialog", { name: "Menú" }).getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Faccount$/);
  });

  test("phones: an admin's menu links the admin panel", async ({ page }) => {
    await page.goto("/login");
    await logIn(page, E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
    await expect(page.getByTestId("account-menu")).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const menu = page.getByRole("dialog", { name: "Menú" });
    await menu.getByRole("link", { name: "Administración" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Panel de administración" })).toBeVisible();
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

  for (const colorScheme of ["light", "dark"] as const) {
    test(`the 403 page, the admin panel and the phone menu pass axe (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await signUpFresh(page, "Axe Cliente");
      expect((await page.goto("/admin"))?.status()).toBe(403);
      await expect(page.getByRole("heading", { level: 1, name: "No tienes permiso para ver esta página" })).toBeVisible();
      await expect.poll(() => seriousAxeViolations(page), { timeout: 15_000 }).toEqual([]);

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      await page.getByRole("button", { name: "Abrir menú" }).click();
      await expect(page.getByRole("dialog", { name: "Menú" }).getByRole("link", { name: "Mi cuenta" })).toBeVisible();
      await expect.poll(() => seriousAxeViolations(page), { timeout: 15_000 }).toEqual([]);

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.context().clearCookies();
      await page.goto("/login?callbackUrl=%2Fadmin");
      await logIn(page, E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
      await expect(page.getByRole("heading", { level: 1, name: "Panel de administración" })).toBeVisible();
      await expect.poll(() => seriousAxeViolations(page), { timeout: 15_000 }).toEqual([]);
    });
  }
});
