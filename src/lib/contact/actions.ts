"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { contactNotificationEmail, newsletterConfirmEmail, newsletterWelcomeEmail } from "@/lib/email/contact";
import { sendEmail } from "@/lib/email/send";
import { confirmResubscribe, subscribe, unsubscribeByToken, type UnsubscribeOutcome } from "@/lib/newsletter";
import { clientIp, rateLimits, waitMessage } from "@/lib/rate-limit";
import { readStoreSettings } from "@/lib/settings";
import { contactSchema, type ContactInput } from "@/lib/validations/contact";
import { newsletterSignupSchema, unsubscribeTokenSchema } from "@/lib/validations/inbox";
import { createContactMessage } from "./messages";

/*
 * The public forms' Server Actions: the contact form (stored for the
 * admin's inbox, /admin/mensajes, and announced to the store by email), the
 * newsletter sign-up (welcome email with the unsubscribe link, or a
 * confirmation email for an address that unsubscribed before), and the
 * buttons of the unsubscribe and confirmation pages. Each one validates with zod and is rate
 * limited by client IP (and the contact form also by sender email).
 * Emails go out after the row is written and never fail the action
 * (src/lib/email/send.ts logs them to the console without Resend).
 */

export type ContactField = keyof ContactInput;

export type ContactResult =
  | { ok: true; email: string }
  | { ok: false; error: string; fieldErrors?: Partial<Record<ContactField, string>> };

async function requestIp(): Promise<string> {
  try {
    return clientIp(await headers());
  } catch {
    return "unknown";
  }
}

const tooMany = (seconds: number) => `Enviaste demasiados mensajes seguidos. Espera ${waitMessage(seconds)} y vuelve a intentarlo.`;

/** Where the store's notices go: STORE_NOTIFY_EMAIL, else the contact email of the settings. */
async function storeNotifyAddress(): Promise<string> {
  const configured = process.env.STORE_NOTIFY_EMAIL?.trim();
  if (configured) return configured;
  return (await readStoreSettings(getDb())).contact.email;
}

/**
 * /contacto. `website` is a honeypot field people never see: a bot that
 * fills it gets the same success and nothing is stored.
 */
export async function sendContactMessageAction(input: unknown): Promise<ContactResult> {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<ContactField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as ContactField | undefined;
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }
  const email = parsed.data.email.toLowerCase();
  if (typeof raw.website === "string" && raw.website.trim()) return { ok: true, email };

  const ip = await requestIp();
  const byIp = await rateLimits.contactIp.consume(`ip:${ip}`);
  if (!byIp.ok) return { ok: false, error: tooMany(byIp.retryAfterSeconds) };
  const byEmail = await rateLimits.contactEmail.consume(email);
  if (!byEmail.ok) return { ok: false, error: tooMany(byEmail.retryAfterSeconds) };

  const user = await getCurrentUser();
  const db = getDb();
  const message = await createContactMessage(db, parsed.data, { userId: user?.id ?? null, ip: ip === "unknown" ? null : ip });
  // The admin's inbox and its count in the panel.
  revalidatePath("/admin/mensajes");
  revalidatePath("/admin");
  await sendEmail(contactNotificationEmail(await storeNotifyAddress(), message));
  return { ok: true, email };
}

export type NewsletterResult = { ok: true; email: string; message: string } | { ok: false; error: string };

/**
 * The footer's sign-up. The answer is the same whether the address was
 * already subscribed or not (nobody learns who is). A new address gets the
 * welcome email; one that unsubscribed gets a confirmation email and stays
 * unsubscribed until its owner confirms (lib/newsletter).
 */
export async function subscribeNewsletterAction(email: unknown, source: unknown = "footer"): Promise<NewsletterResult> {
  const parsed = newsletterSignupSchema.safeParse({ email, source });
  if (!parsed.success) return { ok: false, error: parsed.error.issues.find((issue) => issue.path[0] === "email")?.message ?? "Ingresa un email válido" };
  const ip = await requestIp();
  const limit = await rateLimits.newsletterIp.consume(`ip:${ip}`);
  if (!limit.ok) return { ok: false, error: `Demasiados intentos seguidos. Espera ${waitMessage(limit.retryAfterSeconds)} y vuelve a intentarlo.` };

  const outcome = await subscribe(getDb(), { email: parsed.data.email, source: parsed.data.source, ip: ip === "unknown" ? null : ip });
  if (outcome.status === "subscribed") {
    revalidatePath("/admin/newsletter");
    await sendEmail(newsletterWelcomeEmail(parsed.data.email, outcome.token));
  } else if (outcome.status === "confirm") {
    await sendEmail(newsletterConfirmEmail(parsed.data.email, outcome.token));
  }
  return { ok: true, email: parsed.data.email, message: "¡Listo! Te sumamos al newsletter." };
}

/*
 * The buttons of /newsletter/baja and /newsletter/confirmar (a GET never
 * changes anything: mail scanners open links). Neither revalidates a path:
 * inside a Server Action that re-renders the page the button is on, which
 * would swap the button's result for the page's own "already done" state.
 * The admin's list is dynamic and reads the database on every request.
 */

export async function unsubscribeNewsletterAction(token: unknown): Promise<UnsubscribeOutcome | "rate_limited"> {
  const parsed = unsubscribeTokenSchema.safeParse(token);
  if (!parsed.success) return "invalid";
  const limit = await rateLimits.newsletterUnsubscribe.consume(`ip:${await requestIp()}`);
  if (!limit.ok) return "rate_limited";
  return unsubscribeByToken(getDb(), parsed.data);
}

export type ConfirmSubscriptionResult = "confirmed" | "invalid" | "rate_limited";

export async function confirmNewsletterAction(token: unknown): Promise<ConfirmSubscriptionResult> {
  const parsed = unsubscribeTokenSchema.safeParse(token);
  if (!parsed.success) return "invalid";
  const ip = await requestIp();
  const limit = await rateLimits.newsletterConfirm.consume(`ip:${ip}`);
  if (!limit.ok) return "rate_limited";
  const outcome = await confirmResubscribe(getDb(), parsed.data, { ip: ip === "unknown" ? null : ip });
  if (outcome.status !== "confirmed") return "invalid";
  await sendEmail(newsletterWelcomeEmail(outcome.email, outcome.token));
  return "confirmed";
}
