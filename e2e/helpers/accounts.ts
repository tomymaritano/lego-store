import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

/*
 * Accounts for the auth specs. Every address uses this domain, so the global
 * setup/teardown (e2e/global-setup.ts) can delete them from the dev database,
 * and runs never collide with each other or with real data.
 */
export const E2E_EMAIL_DOMAIN = "e2e.lego-store.test";

/** Created by the global setup with a random password (E2E_ADMIN_PASSWORD). */
export const E2E_ADMIN_EMAIL = `admin@${E2E_EMAIL_DOMAIN}`;

export const PASSWORD = "bloques-de-prueba-42";

export function uniqueEmail(label = "user"): string {
  return `${label}-${randomUUID().slice(0, 8)}@${E2E_EMAIL_DOMAIN}`;
}

/**
 * A field of the page's own form, by its exact label (required ones end in a
 * "*"). Scoped to <main>: the footer has a newsletter "Tu email" field too.
 */
export const field = (page: Page, label: string) =>
  page.getByRole("main").getByLabel(new RegExp(`^${label}[*]?$`));

export async function register(page: Page, { name, email, password = PASSWORD }: { name: string; email: string; password?: string }) {
  await field(page, "Nombre").fill(name);
  await field(page, "Email").fill(email);
  await field(page, "Contraseña").fill(password);
  await field(page, "Repite la contraseña").fill(password);
  await page.getByRole("main").getByRole("button", { name: "Crear cuenta" }).click();
}

export async function logIn(page: Page, email: string, password = PASSWORD) {
  await field(page, "Email").fill(email);
  await field(page, "Contraseña").fill(password);
  await page.getByRole("main").getByRole("button", { name: "Iniciar sesión" }).click();
}

/** Registers a fresh account from /register and waits until it is signed in. */
export async function signUpFresh(page: Page, name = "Ana Prueba") {
  const email = uniqueEmail();
  await page.goto("/register");
  await register(page, { name, email });
  // Registration hashes and then verifies a bcrypt password: slow on purpose, slower under parallel workers.
  await expect(page.getByTestId("account-menu")).toBeVisible({ timeout: 15_000 });
  return email;
}
