import { test, expect } from "@playwright/test";

test.describe("Checkout", () => {
  test.beforeEach(async ({ page }) => {
    // Add item to cart before each test
    await page.goto("/");

    const firstProduct = page.locator("[data-testid='product-card']").first();
    await firstProduct.click();

    await expect(page).toHaveURL(/\/item\//);

    const addToCartBtn = page.locator("button", { hasText: /agregar|añadir|cart/i });
    await addToCartBtn.first().click();

    // Wait for cart update
    await page.waitForTimeout(500);
  });

  test("should display checkout form with validation", async ({ page }) => {
    await page.goto("/checkout");

    // Try to submit empty form
    const submitBtn = page.locator("button[type='submit']");
    await submitBtn.click();

    // Should show validation errors
    const errorMessages = page.locator("text=/debe tener|inválido|required/i");
    await expect(errorMessages.first()).toBeVisible({ timeout: 3000 });
  });

  test("should fill shipping form", async ({ page }) => {
    await page.goto("/checkout");

    // Fill shipping form
    await page.fill("input[name='firstName']", "Juan");
    await page.fill("input[name='lastName']", "Pérez");
    await page.fill("input[name='email']", "juan@example.com");
    await page.fill("input[name='phone']", "5512345678");
    await page.fill("input[name='address']", "Av. Reforma 123");
    await page.fill("input[name='city']", "Ciudad de México");
    await page.fill("input[name='state']", "CDMX");
    await page.fill("input[name='zipCode']", "06600");

    // Submit form
    const submitBtn = page.locator("button[type='submit']");
    await submitBtn.click();

    // Should move to payment step
    await expect(page.locator("text=/pago|payment/i")).toBeVisible({ timeout: 5000 });
  });
});
