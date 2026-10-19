import { test, expect } from "@playwright/test";
import { E2E_ADMIN_EMAIL, logIn } from "../helpers/accounts";
import { seriousAxeViolations } from "../helpers/axe";
import { createPaidE2eOrder } from "../helpers/db";
import { loadEnv } from "../../prisma/env";

loadEnv();
/** With Stripe keys in .env.local the production server takes real payments and offers the refund. */
const stripeConfigured = ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"].every((name) =>
  Boolean(process.env[name]?.trim())
);

/*
 * The production build runs without Stripe keys (paymentsMode "unconfigured";
 * a build never uses the mock). An admin looking at a paid order there must
 * see up front that it cannot be cancelled and refunded, not after a
 * confirmation dialog that then fails. Shipping does not touch Stripe and
 * stays available.
 */
test("without payments, a paid order's refund is offered disabled with the reason", async ({ page }) => {
  test.skip(stripeConfigured, "Stripe está configurado: el reembolso se ofrece habilitado.");
  test.slow();
  const order = await createPaidE2eOrder("prod-refund");

  await page.goto(`/login?callbackUrl=${encodeURIComponent(`/admin/orders/${order.id}`)}`);
  await logIn(page, E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
  await expect(page.getByTestId("admin-order-status")).toHaveText("Pagado", { timeout: 30_000 });

  const refund = page.getByRole("button", { name: "Cancelar y reembolsar" });
  await expect(refund).toBeDisabled();
  await expect(page.getByTestId("order-cancel-blocked")).toHaveText(/Los pagos no están configurados en este servidor/);
  await expect(refund).toHaveAccessibleDescription(/reembolsar el pago/);
  // Shipping does not touch Stripe: it stays available.
  await expect(page.getByRole("button", { name: "Marcar como enviado" })).toBeEnabled();
  await expect(page.getByText(/Subtotal \(1 producto\)/)).toBeVisible();
  expect(await seriousAxeViolations(page)).toEqual([]);
});
