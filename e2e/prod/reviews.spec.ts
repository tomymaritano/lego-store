import { test, expect } from "@playwright/test";

/**
 * The reviews summary on the production build: the histogram bars fill once
 * the reviews tab opens. The summary mounts inside the tab panel while it is
 * hidden, and an in-view animation never filled them on this build.
 */
test("the star histogram bars fill when the reviews tab opens", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/item/1");
  await page.getByRole("tab", { name: /Reseñas/ }).click();
  const bars = page.getByRole("list", { name: "Distribución de valoraciones" }).locator("li > span[aria-hidden] > span");
  await expect(bars).toHaveCount(5);
  // The widest bar (a rating someone gave) has a horizontal scale above 0.
  await expect
    .poll(() =>
      bars.evaluateAll((nodes) =>
        Math.max(
          ...nodes.map((node) => {
            const transform = getComputedStyle(node).transform;
            return transform === "none" ? 1 : new DOMMatrixReadOnly(transform).a;
          })
        )
      )
    )
    .toBeGreaterThan(0);
});
