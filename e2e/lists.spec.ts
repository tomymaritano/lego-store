import { test, expect, type Page } from "@playwright/test";

const seed = (page: Page, key: string, state: unknown) =>
  page.addInitScript(
    ([k, v]) => {
      // Only seed on the first load of the test, so reloads keep what the page saved.
      if (!sessionStorage.getItem(`seeded:${k}`)) {
        localStorage.setItem(k, JSON.stringify({ state: v, version: 1 }));
        sessionStorage.setItem(`seeded:${k}`, "1");
      }
    },
    [key, state] as const
  );

const cartLine = (id: string, name: string, price: number, quantity = 1, stock = 10) => ({
  id,
  name,
  price,
  image: "/images/lego.png",
  quantity,
  stock,
});

const storedCart = (page: Page) =>
  page.evaluate(() =>
    (JSON.parse(localStorage.getItem("lego-cart-storage")!).state.cart as { id: string; quantity: number }[]).map(
      (line) => `${line.id}x${line.quantity}`
    )
  );

/** WCAG contrast ratio between two computed `rgb(r, g, b)` colours. */
function contrastRatio(a: string, b: string) {
  const luminance = (rgb: string) => {
    const [r, g, bl] = rgb.match(/\d+(\.\d+)?/g)!.slice(0, 3).map((c) => {
      const v = Number(c) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test.describe("Cart page", () => {
  test("updates totals, shipping progress and free shipping as quantities change", async ({ page }) => {
    await seed(page, "lego-cart-storage", { cart: [cartLine("1", "Captain Rex Helmet", 2000, 1)] });
    await page.goto("/cart");

    await expect(page.getByRole("heading", { level: 1, name: "Carrito de compras" })).toBeVisible();
    const summary = page.getByRole("region", { name: "Resumen del pedido" });
    await expect(summary.getByTestId("cart-shipping")).toHaveText(/299/);
    await expect(summary.getByTestId("free-shipping")).toContainText("Te faltan");
    await expect(summary.getByTestId("cart-total")).toHaveText(/2\.299/);

    const stepper = page.getByRole("group", { name: "Cantidad de Captain Rex Helmet" });
    await stepper.getByRole("button", { name: "Aumentar cantidad" }).click();
    await stepper.getByRole("button", { name: "Aumentar cantidad" }).click();

    await expect(summary.getByTestId("cart-shipping")).toHaveText("Gratis");
    await expect(summary.getByTestId("free-shipping")).toContainText("¡Tienes envío gratis!");
    await expect(summary.getByTestId("cart-total")).toHaveText(/6\.000/);
    await expect(page.getByTestId("cart-line-total")).toHaveText(/6\.000/);
    expect(await storedCart(page)).toEqual(["1x3"]);

    await summary.getByRole("link", { name: /Finalizar compra/ }).click();
    await expect(page).toHaveURL(/\/checkout/);
  });

  test("removing a line keeps focus in the list and the toast can undo it", async ({ page }) => {
    await seed(page, "lego-cart-storage", {
      cart: [cartLine("1", "Captain Rex Helmet", 899, 2), cartLine("2", "Princess Leia Helmet", 649)],
    });
    await page.goto("/cart");
    await expect(page.getByTestId("cart-item")).toHaveCount(2);

    await page.getByRole("button", { name: "Eliminar Captain Rex Helmet del carrito" }).click();
    await expect(page.getByTestId("cart-item")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Eliminar Princess Leia Helmet del carrito" })).toBeFocused();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.getByTestId("cart-item")).toHaveCount(2);
    await expect(page.getByTestId("cart-item-name").first()).toHaveText("Captain Rex Helmet");
    expect(await storedCart(page)).toEqual(["1x2", "2x1"]);
  });

  test("an emptied cart shows the empty state with recommended products", async ({ page }) => {
    await seed(page, "lego-cart-storage", { cart: [cartLine("1", "Captain Rex Helmet", 899)] });
    await page.goto("/cart");

    await page.getByRole("button", { name: "Vaciar carrito" }).click();
    await expect(page.getByRole("heading", { name: "Tu carrito está vacío" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Carrito de compras" })).toBeFocused();
    const recommended = page.getByRole("region", { name: "Te puede interesar" });
    await recommended.scrollIntoViewIfNeeded();
    await expect(recommended.getByTestId("product-card").first()).toBeVisible();

    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.getByTestId("cart-item")).toHaveCount(1);
  });

  test("the undo toast keeps its action on one line on phones", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seed(page, "lego-cart-storage", {
      cart: [
        cartLine("1", "Millennium Falcon Ultimate Collector Series edición especial", 15999),
        cartLine("2", "Princess Leia Helmet", 649),
      ],
    });
    await page.goto("/cart");
    await page
      .getByRole("button", { name: "Eliminar Millennium Falcon Ultimate Collector Series edición especial del carrito" })
      .click();
    const undo = page.getByRole("button", { name: "Deshacer" });
    await expect(undo).toBeVisible();
    const lines = await undo.evaluate((el) => {
      const style = getComputedStyle(el);
      const content = el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      return Math.round(content / parseFloat(style.lineHeight));
    });
    expect(lines).toBe(1);
    expect(await undo.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });

  test("fits a phone screen without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await seed(page, "lego-cart-storage", {
      cart: [cartLine("1", "Millennium Falcon Ultimate Collector Series edición especial", 15999, 1)],
    });
    await page.goto("/cart");
    await expect(page.getByTestId("cart-item")).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // The line title stays body-sized, not a page heading.
    const fontSize = await page.getByTestId("cart-item").getByRole("heading").evaluate((el) => getComputedStyle(el).fontSize);
    expect(fontSize).toBe("16px");
  });
});

test.describe("Wishlist page", () => {
  const saved = [
    { id: "1", name: "Captain Rex Helmet", price: 899, image: "/images/lego.png", stock: 10 },
    { id: "2", name: "Princess Leia Helmet", price: 649, image: "/images/lego.png", stock: 10 },
  ];

  test("moves a product to the cart and undo brings it back", async ({ page }) => {
    await seed(page, "lego-wishlist-storage", { wishlist: saved });
    await page.goto("/wishlist");

    await expect(page.getByTestId("wishlist-item")).toHaveCount(2);
    const rex = page.getByTestId("wishlist-item").filter({ hasText: "Captain Rex Helmet" });
    await rex.getByRole("button", { name: "Mover al carrito" }).click();

    await expect(page.getByTestId("wishlist-item")).toHaveCount(1);
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await expect(page.getByTestId("wishlist-count")).toHaveText("1");

    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.getByTestId("wishlist-item")).toHaveCount(2);
    await expect(page.getByTestId("cart-count")).toHaveCount(0);
  });

  test("removes items, then shows the empty state with recommendations", async ({ page }) => {
    await seed(page, "lego-wishlist-storage", { wishlist: saved.slice(0, 1) });
    await page.goto("/wishlist");

    await page.getByRole("button", { name: "Quitar Captain Rex Helmet de favoritos" }).click();
    await expect(page.getByRole("heading", { name: "Tu lista de deseos está vacía" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Lista de deseos" })).toBeFocused();
    await expect(page.getByRole("region", { name: "Te puede interesar" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Tu lista de deseos está vacía" })).toBeVisible();
  });

  test("moves everything in stock to the cart at once", async ({ page }) => {
    await seed(page, "lego-wishlist-storage", { wishlist: saved });
    await page.goto("/wishlist");
    await expect(page.getByTestId("wishlist-item")).toHaveCount(2);

    await page.getByRole("button", { name: "Mover todo al carrito" }).click();
    await expect(page.getByRole("heading", { name: "Tu lista de deseos está vacía" })).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("2");
  });

  test("undoing 'Mover todo' keeps a recommended product added in the meantime", async ({ page }) => {
    await seed(page, "lego-wishlist-storage", { wishlist: saved });
    await page.goto("/wishlist");
    await expect(page.getByTestId("wishlist-item")).toHaveCount(2);

    await page.getByRole("button", { name: "Mover todo al carrito" }).click();
    const recommended = page.getByRole("region", { name: "Te puede interesar" });
    await recommended.locator("[data-testid=add-to-cart-btn]:not([data-in-cart])").first().click();
    await expect(page.getByTestId("cart-count")).toHaveText("3");
    const withRecommended = await storedCart(page);
    const added = withRecommended.find((entry) => !["1x1", "2x1"].includes(entry))!;
    expect(added).toBeTruthy();

    // Sonner stacks toasts; hovering the stack expands it so the older one's action is reachable.
    const moved = page.locator("[data-sonner-toast]").filter({ hasText: "2 productos movidos al carrito" });
    await moved.hover();
    await moved.getByRole("button", { name: "Deshacer" }).click();

    await expect(page.getByTestId("wishlist-item")).toHaveCount(2);
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    expect(await storedCart(page)).toEqual([added]);
  });

  test("a set already at its stock limit in the cart stays saved", async ({ page }) => {
    await seed(page, "lego-cart-storage", { cart: [cartLine("1", "Captain Rex Helmet", 899, 10, 10)] });
    await seed(page, "lego-wishlist-storage", { wishlist: saved });
    await page.goto("/wishlist");

    const rex = page.getByTestId("wishlist-item").filter({ hasText: "Captain Rex Helmet" });
    await expect(rex.getByTestId("move-to-cart-btn")).toBeDisabled();
    await expect(rex.getByTestId("move-to-cart-btn")).toHaveText(/Máximo en el carrito/);
    await expect(page.getByRole("button", { name: "Mover todo al carrito" })).toHaveCount(0);

    // Price and CTA line up across the row, with or without the in-cart note.
    const leia = page.getByTestId("wishlist-item").filter({ hasText: "Princess Leia Helmet" });
    const [a, b] = await Promise.all([rex, leia].map((card) => card.getByTestId("move-to-cart-btn").boundingBox()));
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(1);
  });
});

test.describe("Compare page", () => {
  test("highlights differences, removes with undo and adds to the cart", async ({ page }) => {
    await seed(page, "lego-compare-storage", { ids: ["1", "2", "5"] });
    await page.goto("/compare");

    const table = page.getByRole("table");
    await expect(table.getByTestId("compare-column")).toHaveCount(3);
    await expect(page.getByRole("link", { name: /Agregar producto/ })).toBeVisible();

    const highlight = page.getByRole("checkbox", { name: "Resaltar diferencias" });
    await highlight.click();
    await expect(highlight).toBeChecked();
    await expect(table.getByRole("rowheader", { name: /Precio.*valores distintos/ })).toBeVisible();
    await expect(table.getByRole("rowheader", { name: /^Categoría$/ })).toBeVisible();

    await page.getByRole("button", { name: /^Quitar .+ de la comparación$/ }).first().click();
    await expect(table.getByTestId("compare-column")).toHaveCount(2);
    await expect(page.getByTestId("compare-page-count")).toHaveText("2 de 4 productos como máximo");
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(table.getByTestId("compare-column")).toHaveCount(3);

    await table.getByTestId("add-to-cart-btn").first().click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
  });

  test("highlighted rows are tinted visibly in dark mode, and stock counts are compared", async ({ page }) => {
    await seed(page, "lego-compare-storage", { ids: ["1", "3", "11", "15"] });
    await page.goto("/compare");
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    const table = page.getByRole("table");
    await expect(table.getByTestId("compare-column")).toHaveCount(4);
    await page.getByRole("checkbox", { name: "Resaltar diferencias" }).click();

    await expect(table.getByRole("rowheader", { name: /Disponibilidad.*valores distintos/ })).toBeVisible();
    const [marked, surface] = await Promise.all([
      table.getByTestId("compare-row-price").locator("td").first().evaluate((el) => getComputedStyle(el).backgroundColor),
      page.getByTestId("compare-scroller").evaluate((el) => getComputedStyle(el).backgroundColor),
    ]);
    // The old bg-muted tint measured about 1.0:1 against the surface in dark mode.
    expect(contrastRatio(marked, surface)).toBeGreaterThanOrEqual(1.1);
  });

  test("scrolls sideways on phones while the labels stay in view", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seed(page, "lego-compare-storage", { ids: ["1", "2", "5", "6"] });
    await page.goto("/compare");

    const scroller = page.getByTestId("compare-scroller");
    await expect(page.getByRole("table").getByTestId("compare-column")).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    const label = page.getByRole("rowheader", { name: "Precio" });
    const before = (await label.boundingBox())!.x;
    await scroller.evaluate((el) => el.scrollBy({ left: 400, behavior: "instant" }));
    await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    expect((await label.boundingBox())!.x).toBeCloseTo(before, 0);
  });

  test("clearing shows the empty state", async ({ page }) => {
    await seed(page, "lego-compare-storage", { ids: ["1"] });
    await page.goto("/compare");
    await expect(page.getByRole("checkbox", { name: "Resaltar diferencias" })).toBeDisabled();
    await page.getByRole("button", { name: "Limpiar todo" }).click();
    await expect(page.getByRole("heading", { name: "No hay productos para comparar" })).toBeVisible();
  });
});
