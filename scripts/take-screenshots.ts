import { chromium } from "playwright";
import path from "path";

const SCREENSHOTS_DIR = path.join(process.cwd(), "screenshots");
const BASE_URL = "http://localhost:3000";

async function takeScreenshots() {
  const browser = await chromium.launch();

  // Desktop viewport
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await desktopContext.newPage();

  console.log("Taking screenshots...");

  // Home - Light Mode
  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, "home-light.png"),
    fullPage: false
  });
  console.log("✓ home-light.png");

  // Home - Dark Mode
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, "home-dark.png"),
    fullPage: false
  });
  console.log("✓ home-dark.png");

  // Product Detail - navigate directly (ID 1 = Captain Rex Helmet)
  await page.goto(`${BASE_URL}/item/1`);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, "product-detail.png"),
    fullPage: false
  });
  console.log("✓ product-detail.png");

  // Cart page
  await page.goto(`${BASE_URL}/cart`);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, "cart.png"),
    fullPage: false
  });
  console.log("✓ cart.png");

  // Checkout page
  await page.goto(`${BASE_URL}/checkout`);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, "checkout.png"),
    fullPage: false
  });
  console.log("✓ checkout.png");

  // Mobile viewport
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto(BASE_URL);
  await mobilePage.waitForLoadState("networkidle");
  await mobilePage.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await mobilePage.waitForTimeout(1500);
  await mobilePage.screenshot({
    path: path.join(SCREENSHOTS_DIR, "mobile.png"),
    fullPage: false
  });
  console.log("✓ mobile.png");

  await browser.close();
  console.log("\nAll screenshots saved to ./screenshots/");
}

takeScreenshots().catch(console.error);
