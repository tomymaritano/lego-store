import { test, expect } from "@playwright/test";

const INFO_PAGES = [
  ["/faq", "Preguntas frecuentes"],
  ["/envios", "Envíos y entregas"],
  ["/devoluciones", "Cambios y devoluciones"],
  ["/contacto", "Contacto"],
  ["/nosotros", "Sobre nosotros"],
  ["/privacidad", "Política de privacidad"],
  ["/terminos", "Términos y condiciones"],
] as const;

test.describe("App shell", () => {
  test("skip link jumps to the main landmark", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Saltar al contenido principal" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main-content")).toBeFocused();
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeAttached();
  });

  test("marks the current category in the desktop nav", async ({ page }) => {
    await page.goto("/category/helmet");
    const nav = page.getByRole("navigation", { name: "Principal" });
    await expect(nav.getByRole("link", { name: "Helmets" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Todos" })).not.toHaveAttribute("aria-current");
  });

  test("themes disclosure opens, lists searches and closes on Escape", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Temas" });
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "Marvel" }).first()).toHaveAttribute("href", "/search?q=Marvel");
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  });

  test("first load is not hidden behind the page transition", async ({ page }) => {
    await page.goto("/faq");
    const opacity = await page
      .getByRole("heading", { level: 1, name: "Preguntas frecuentes" })
      .evaluate((el) => getComputedStyle(el.closest("main > div") as Element).opacity);
    expect(opacity).toBe("1");
  });

  test("compare badge counts queued products and links to /compare", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("lego-compare-storage", JSON.stringify({ state: { ids: ["1", "2"] }, version: 1 }));
    });
    await page.goto("/faq");
    const compare = page.getByRole("link", { name: "Comparar, 2 productos" });
    await expect(compare).toHaveAttribute("href", "/compare");
    await expect(page.getByTestId("compare-count")).toHaveText("2");
  });
});

test.describe("Cart drawer", () => {
  test("shows lines, free-shipping progress and checkout CTA", async ({ page }) => {
    await page.goto("/search?q=star");
    await page.getByTestId("product-card").first().getByTestId("add-to-cart-btn").click();
    await page.getByTestId("cart-button").click();
    const drawer = page.getByRole("dialog", { name: /Carrito/ });
    await expect(page.getByRole("dialog", { name: "Carrito (1)" })).toBeVisible();
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("cart-item")).toHaveCount(1);
    await expect(drawer.getByTestId("free-shipping")).toContainText("para el envío gratis");
    await expect(drawer.getByRole("link", { name: "Finalizar compra" })).toHaveAttribute("href", "/checkout");

    await drawer.getByRole("button", { name: /Eliminar .* del carrito/ }).click();
    await expect(drawer.getByRole("heading", { name: "Tu carrito está vacío" })).toBeVisible();
  });
});

test.describe("Mobile shell", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("menu opens as a sheet, lists categories and navigates", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const menu = page.getByRole("dialog", { name: "Menú" });
    await expect(menu).toBeVisible();
    await menu.getByRole("link", { name: "Brickheadz" }).click();
    await expect(page).toHaveURL(/\/category\/brickheadz/);
    await expect(menu).toBeHidden();
  });

  test("full-screen search shows suggestions and opens a product", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Buscar" });
    await expect(sheet).toBeVisible();
    const input = sheet.getByRole("combobox", { name: "Buscar productos" });
    await expect(input).toBeFocused();
    await input.fill("helmet");
    const first = sheet.getByRole("option").first();
    await expect(first).toBeVisible();
    await expect(first.locator("mark").first()).toHaveText(/helmet/i);
    await first.click();
    await expect(page).toHaveURL(/\/item\//);
    await expect(sheet).toBeHidden();
  });

  for (const scrolled of [false, true]) {
    test(`toasts drop in below the sticky header, leaving the cart button hittable (scrolled: ${scrolled})`, async ({
      page,
    }) => {
      await page.goto("/category/helmet");
      const card = page.getByTestId("product-card").nth(scrolled ? 3 : 0);
      await card.scrollIntoViewIfNeeded();
      // Scrolled: the promo bar is gone and the header sits stuck at top: 0.
      if (scrolled) await page.evaluate(() => window.scrollBy(0, 300));
      await card.getByTestId("add-to-cart-btn").click();
      const toast = page.locator("[data-sonner-toast]").first();
      await expect(toast).toBeVisible();

      const header = (await page.locator("[data-site-header]").boundingBox())!;
      if (scrolled) expect(header.y).toBe(0);
      // Let the toast settle into place before probing.
      await expect.poll(async () => (await toast.boundingBox())!.y).toBeGreaterThanOrEqual(header.y + header.height);

      const box = (await page.getByTestId("cart-button").boundingBox())!;
      const hitsCart = await page.evaluate(
        ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-testid="cart-button"]'),
        { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      );
      expect(hitsCart).toBe(true);
    });
  }

  test("no horizontal scroll on the shell and info pages", async ({ page }) => {
    for (const path of ["/", "/contacto", "/envios"]) {
      await page.goto(path);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width, path).toBeLessThanOrEqual(390);
    }
  });
});

test.describe("Footer and info pages", () => {
  test("every footer link resolves (no dead links)", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page
      .getByRole("contentinfo")
      .locator("a[href^='/']")
      .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute("href")!))]);
    expect(hrefs.length).toBeGreaterThan(15);
    for (const href of hrefs) {
      const response = await request.get(href);
      expect(response.status(), href).toBe(200);
    }
  });

  for (const [path, title] of INFO_PAGES) {
    test(`${path} renders its page with metadata`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page).toHaveTitle(new RegExp(`${title} \\| LEGO Store`));
      await expect(page.locator("meta[property='og:locale']")).toHaveAttribute("content", "es_AR");
      await expect(page.getByRole("navigation", { name: "Ayuda e información" })).toBeVisible();
    });
  }

  test("FAQ answers expand with the keyboard", async ({ page }) => {
    await page.goto("/faq");
    const summary = page.getByText("¿Cuánto cuesta el envío?");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/es gratis en compras desde/)).toBeVisible();
  });

  test("contact form validates and confirms a mock submission", async ({ page }) => {
    await page.goto("/contacto");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.getByText("Ingresa tu nombre (al menos 2 caracteres)")).toBeVisible();
    await expect(page.getByLabel(/^Nombre/)).toBeFocused();

    await page.getByLabel(/^Nombre/).fill("Ana Pérez");
    await page.getByLabel(/^Email/).fill("ana@example.com");
    await page.getByRole("combobox", { name: /Motivo/ }).click();
    await page.getByRole("option", { name: "Estado de un pedido" }).click();
    await page.getByLabel(/^Mensaje/).fill("¿Cuándo llega mi pedido LS-12345? Gracias.");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.getByRole("heading", { name: "¡Mensaje enviado!" })).toBeFocused();
  });

  test("newsletter in the footer validates and confirms", async ({ page }) => {
    await page.goto("/faq");
    const form = page.getByRole("form", { name: "Suscríbete al newsletter" });
    await form.getByRole("button", { name: "Suscribirse" }).click();
    await expect(form.getByText("Ingresa tu email")).toBeVisible();
    await form.getByLabel("Tu email").fill("fan@lego.com");
    await form.getByRole("button", { name: "Suscribirse" }).click();
    await expect(page.getByText("Suscribimos fan@lego.com. Revisa tu correo.")).toBeVisible();
  });
});

test.describe("Shell review fixes", () => {
  test("home offers one newsletter sign-up and one set of store promises", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("form", { name: /newsletter|Nuevo en LEGO/i })).toHaveCount(1);
    await expect(page.getByText(/^Envío gratis$/)).toHaveCount(1);
  });

  for (const [path, title] of [
    ["/search?q=star", "Resultados para “star”"],
    ["/cart", "Carrito de Compras"],
    ["/compare", "Comparar Productos"],
    ["/wishlist", "Lista de Deseos"],
    ["/checkout", "Checkout"],
  ] as const) {
    test(`${path} shares its own title on social cards`, async ({ page }) => {
      await page.goto(path);
      const fullTitle = `${title} | LEGO Store`;
      await expect(page).toHaveTitle(fullTitle);
      await expect(page.locator("meta[property='og:title']")).toHaveAttribute("content", fullTitle);
      await expect(page.locator("meta[name='twitter:title']")).toHaveAttribute("content", fullTitle);
      await expect(page.locator("meta[property='og:url']")).toHaveAttribute("content", /^https?:\/\//);
      await expect(page.locator("link[rel='canonical']")).toHaveCount(1);
      await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);
    });
  }

  test("the compare bar's reserved room sits inside the footer, not below it", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("lego-compare-storage", JSON.stringify({ state: { ids: ["1"] }, version: 1 }));
    });
    await page.goto("/envios");
    await expect(page.locator("html")).toHaveAttribute("data-compare-bar", "");
    const layout = await page.evaluate(() => {
      const bottom = document.querySelector("[data-footer-bottom]")!;
      return {
        bodyPadding: parseFloat(getComputedStyle(document.body).paddingBottom),
        footerPadding: parseFloat(getComputedStyle(bottom).paddingBottom),
        gapBelowFooter: document.documentElement.scrollHeight - (bottom.getBoundingClientRect().bottom + window.scrollY),
      };
    });
    expect(layout.bodyPadding).toBe(0);
    expect(layout.footerPadding).toBeGreaterThan(80);
    expect(Math.abs(layout.gapBelowFooter)).toBeLessThan(2);
  });

  test("info fact cards do not pretend to be interactive", async ({ page }) => {
    await page.goto("/envios");
    const card = page.locator("main li").filter({ hasText: "Envío gratis" }).first();
    const before = await card.evaluate((el) => `${getComputedStyle(el).translate} ${getComputedStyle(el).boxShadow}`);
    await card.hover();
    await page.waitForTimeout(400); // longer than any hover transition
    expect(await card.evaluate((el) => `${getComputedStyle(el).translate} ${getComputedStyle(el).boxShadow}`)).toBe(before);
  });
});

test.describe("Not found", () => {
  test("unknown routes get the designed 404 with a way home", async ({ page }) => {
    const response = await page.goto("/esto-no-existe");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Esta pieza no está en la caja" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/");
  });
});
