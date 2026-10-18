import { test, expect, type Page } from "@playwright/test";
import { logIn, register, uniqueEmail } from "./helpers/accounts";

/*
 * The cart and wishlist follow the account, against the dev database: a
 * visitor's lists are merged into the account on sign-up/login (quantities
 * added up, capped by stock; wishlists united), the server is the truth from
 * then on (another browser sees the same lists, with current prices), and
 * logging out clears this browser's copy.
 */

const seedOnce = (page: Page, entries: Record<string, unknown>) =>
  page.addInitScript((stores) => {
    if (sessionStorage.getItem("seeded")) return;
    for (const [key, state] of Object.entries(stores)) localStorage.setItem(key, JSON.stringify({ state, version: 1 }));
    sessionStorage.setItem("seeded", "1");
  }, entries);

/** A stale snapshot, as a visitor's browser may hold it (wrong price, old stock). */
const staleLine = (id: string, quantity: number) => ({ id, name: `Producto ${id}`, price: 1, image: "/images/lego.png", quantity, stock: 99 });
const staleItem = (id: string) => ({ id, name: `Producto ${id}`, price: 1, image: "/images/lego.png", stock: 99 });

const stored = (page: Page) =>
  page.evaluate(() => {
    const read = (key: string) => JSON.parse(localStorage.getItem(key) ?? "{}").state ?? {};
    const cart = read("lego-cart-storage");
    const wishlist = read("lego-wishlist-storage");
    return {
      cart: ((cart.cart ?? []) as { id: string; quantity: number }[]).map((line) => `${line.id}x${line.quantity}`),
      prices: ((cart.cart ?? []) as { id: string; price: number }[]).map((line) => line.price),
      wishlist: ((wishlist.wishlist ?? []) as { id: string }[]).map((item) => item.id),
      owner: cart.owner ?? null,
    };
  });

test.describe("Cart and wishlist with an account", () => {
  test("a visitor's cart shows current prices and stock, not the stored snapshot", async ({ page }) => {
    const [rex] = (await (await page.request.get("/api/products/by-ids?ids=1")).json()).items as { name: string; price: number; stock: number }[];
    await seedOnce(page, { "lego-cart-storage": { cart: [staleLine("1", rex!.stock + 5), staleLine("no-existe", 1)] } });
    await page.goto("/cart");
    await expect.poll(() => stored(page)).toMatchObject({ cart: [`1x${rex!.stock}`], prices: [rex!.price], owner: null });
    await expect(page.getByTestId("cart-item-name")).toHaveText([rex!.name]);
  });

  test("guest lists merge into the account, follow it to another browser, and leave with logout", async ({ page, browser }) => {
    // Two sign-ins (bcrypt, slow on purpose) and two browsers.
    test.slow();
    const [rex] = (await (await page.request.get("/api/products/by-ids?ids=1")).json()).items as { price: number; stock: number }[];

    // A visitor with a cart and a favourite signs up.
    await seedOnce(page, { "lego-cart-storage": { cart: [staleLine("1", 2)] }, "lego-wishlist-storage": { wishlist: [staleItem("2")] } });
    const email = uniqueEmail("lists");
    await page.goto("/register");
    await register(page, { name: "Carrito E2E", email });
    await expect(page.getByTestId("account-menu")).toBeVisible({ timeout: 15_000 });

    // Merged into the account; the browser now holds the server's lines (real price, not the snapshot).
    await expect.poll(async () => (await stored(page)).owner).not.toBeNull();
    expect(await stored(page)).toMatchObject({ cart: ["1x2"], prices: [rex!.price], wishlist: ["2"] });
    await expect(page.getByTestId("cart-count")).toHaveText("2");
    await expect(page.getByTestId("wishlist-count")).toHaveText("1");

    // Another browser, with its own guest cart, logs in to the same account: quantities add up.
    const other = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const second = await other.newPage();
    await seedOnce(second, { "lego-cart-storage": { cart: [staleLine("1", 1), staleLine("3", 1)] }, "lego-wishlist-storage": { wishlist: [staleItem("4")] } });
    await second.goto("/login");
    await logIn(second, email);
    await expect(second.getByTestId("account-menu")).toBeVisible({ timeout: 15_000 });
    const merged = `1x${Math.min(3, rex!.stock)}`;
    await expect.poll(() => stored(second)).toMatchObject({ cart: [merged, "3x1"], wishlist: ["2", "4"] });

    // A change there is saved on the server: the first browser sees it after a reload.
    await second.goto("/cart");
    // The removal shows at once; the Server Action (a POST to this page) saves it.
    const saved = second.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/cart"));
    await second.getByRole("button", { name: /Eliminar .* del carrito/ }).last().click();
    await expect.poll(() => stored(second)).toMatchObject({ cart: [merged] });
    await saved;
    await page.reload();
    await expect.poll(() => stored(page)).toMatchObject({ cart: [merged], wishlist: ["2", "4"] });
    await other.close();

    // Logout clears this browser's copy of the account's lists.
    await page.getByTestId("account-menu").click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    // Logout redirects home, a full server render: slow while every worker hits the dev server.
    await expect(page.getByTestId("login-link")).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => stored(page)).toEqual({ cart: [], prices: [], wishlist: [], owner: null });
    await expect(page.getByTestId("cart-count")).toHaveCount(0);
  });

  test("the login merge adds a guest cart once, even when another sync starts while it is out", async ({ page }) => {
    test.slow();
    await seedOnce(page, { "lego-cart-storage": { cart: [staleLine("1", 2)] } });
    // Every Server Action POST (the merge among them) makes the tab "come back into view"
    // right away, which asks for another sync while the merge is still out.
    await page.addInitScript(() => {
      const original = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const headers = new Headers(init?.headers);
        if (init?.method === "POST" && headers.has("next-action")) {
          setTimeout(() => document.dispatchEvent(new Event("visibilitychange")), 0);
        }
        return original(input, init);
      };
    });
    const email = uniqueEmail("lists-once");
    await page.goto("/register");
    await register(page, { name: "Carrito Una Vez", email });
    await expect(page.getByTestId("account-menu")).toBeVisible({ timeout: 15_000 });

    await expect.poll(async () => (await stored(page)).owner).not.toBeNull();
    // Settle: any second sync has run by now.
    await page.waitForLoadState("networkidle");
    expect((await stored(page)).cart).toEqual(["1x2"]);
    const lists = (await (await page.request.get("/api/lists")).json()) as { cart: { id: string; quantity: number }[] };
    expect(lists.cart.map((line) => `${line.id}x${line.quantity}`)).toEqual(["1x2"]);
  });
});
