import { test, expect } from "@playwright/test";
import { createE2eSubscriber, isE2eSubscriberActive } from "./helpers/db";

/*
 * The newsletter's links: the unsubscribe page and the confirmation an
 * address that opted out gets when someone signs it up again. Opening a
 * link changes nothing; the button does, and its result stays on screen
 * with the focus on it.
 */

test("the unsubscribe button unsubscribes and says so", async ({ page }) => {
  const subscriber = await createE2eSubscriber();
  await page.goto(`/newsletter/baja?token=${subscriber.unsubscribeToken}`);
  await expect(page.getByText("Vas a dejar de recibir el newsletter")).toBeVisible();
  expect(await isE2eSubscriberActive(subscriber.email)).toBe(true);

  await page.getByRole("button", { name: "Darme de baja" }).click();
  const done = page.getByTestId("unsubscribe-done");
  await expect(done.getByRole("heading", { name: "Listo: te diste de baja" })).toBeVisible();
  await expect(done).toBeFocused();
  // Stays: nothing re-renders the page into its "already unsubscribed" state.
  await page.waitForTimeout(500);
  await expect(page.getByRole("heading", { name: "Ya estabas dado de baja" })).toHaveCount(0);
  expect(await isE2eSubscriberActive(subscriber.email)).toBe(false);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Ya estabas dado de baja" })).toBeVisible();
});

test("an address that opted out comes back only through its confirmation link", async ({ page }) => {
  const subscriber = await createE2eSubscriber({ unsubscribed: true });
  await page.goto(`/newsletter/confirmar?token=${subscriber.confirmToken}`);
  await expect(page.getByText("Vas a volver a recibir el newsletter")).toBeVisible();
  expect(await isE2eSubscriberActive(subscriber.email)).toBe(false);

  await page.getByRole("button", { name: "Confirmar la suscripción" }).click();
  const done = page.getByTestId("confirm-subscription-done");
  await expect(done.getByRole("heading", { name: "Listo: volviste al newsletter" })).toBeVisible();
  await expect(done).toBeFocused();
  expect(await isE2eSubscriberActive(subscriber.email)).toBe(true);

  // Used once: the same link no longer works.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Este enlace no es válido" })).toBeVisible();
});
