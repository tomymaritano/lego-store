/**
 * Footer / home newsletter sign-up. Plain function instead of a zod schema:
 * the form lives in the root layout, so it must not pull zod and
 * react-hook-form into every route's first load.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type NewsletterResult = { ok: true; email: string } | { ok: false; error: string };

export function validateNewsletterEmail(raw: string): NewsletterResult {
  const email = raw.trim();
  if (!email) return { ok: false, error: "Ingresa tu email" };
  if (!EMAIL_PATTERN.test(email)) return { ok: false, error: "Ingresa un email válido" };
  return { ok: true, email };
}
