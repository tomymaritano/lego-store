// README screenshots: `npm run screenshots` against a running production app
// (`npm run build && npm run start`; another origin with BASE_URL=...).
// The theme is chosen through the theme store's localStorage key, so the
// pre-paint script in the layout applies it exactly as for a real visitor.
// The cart is seeded through the UI so the cart and checkout show real lines.
import { chromium } from "@playwright/test";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");
const THEME_STORAGE_KEY = "lego-theme-storage"; // src/lib/theme.ts

const desktop = { viewport: { width: 1440, height: 900 } };
const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

const shots = [
  { file: "home-light.png", url: "/", theme: "light", device: desktop },
  { file: "home-dark.png", url: "/", theme: "dark", device: desktop },
  { file: "product-detail.png", url: "/item/1", theme: "light", device: desktop },
  { file: "cart.png", url: "/cart", theme: "dark", device: desktop },
  { file: "checkout.png", url: "/checkout", theme: "light", device: desktop },
  { file: "mobile.png", url: "/", theme: "dark", device: mobile },
];

/** Adds two products to the cart from their pages and returns the storage state. */
async function seedCart(browser) {
  const context = await browser.newContext(desktop);
  const page = await context.newPage();
  for (const id of ["1", "3"]) {
    await page.goto(`${BASE_URL}/item/${id}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /agregar al carrito/i }).first().click();
    await page.waitForTimeout(500);
    await page.keyboard.press("Escape"); // closes the cart drawer if it opened
  }
  const state = await context.storageState();
  await context.close();
  return state;
}

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  // Entrance animations are <= 300ms plus a short stagger.
  await page.waitForTimeout(800);
}

const browser = await chromium.launch();
try {
  const storageState = await seedCart(browser);
  for (const shot of shots) {
    const context = await browser.newContext({ ...shot.device, storageState, colorScheme: shot.theme });
    await context.addInitScript(
      ([key, theme]) => localStorage.setItem(key, JSON.stringify({ state: { theme }, version: 0 })),
      [THEME_STORAGE_KEY, shot.theme]
    );
    const page = await context.newPage();
    await page.goto(`${BASE_URL}${shot.url}`, { waitUntil: "load" });
    await settle(page);
    await page.screenshot({ path: path.join(OUT, shot.file) });
    console.log(`✓ ${shot.file}`);
    await context.close();
  }
} finally {
  await browser.close();
}
