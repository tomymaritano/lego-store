import "server-only";

import { Resend } from "resend";

/*
 * Outgoing email. With RESEND_API_KEY and EMAIL_FROM set it goes through
 * Resend (without a verified domain Resend only delivers to the account's
 * owner); without them the message is logged to the console instead (dev,
 * tests, CI), so nothing ever fails for lack of an email account.
 *
 * Callers send after their database work has committed, and a failed send is
 * logged, never thrown: an email is a notification, not part of the order.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative (also what the console fallback prints). */
  text: string;
  /** Same key, same email: Resend drops repeats within 24 h (a retried webhook). */
  idempotencyKey?: string;
}

export type EmailResult = { delivered: "resend"; id: string } | { delivered: "console" } | { delivered: "failed"; error: string };

type Env = Record<string, string | undefined>;

export function isEmailConfigured(env: Env = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());
}

let client: Resend | null = null;

export async function sendEmail(message: EmailMessage, env: Env = process.env): Promise<EmailResult> {
  if (!isEmailConfigured(env)) {
    console.info(
      `\n[email] (sin RESEND_API_KEY/EMAIL_FROM: se muestra en vez de enviarse)\nPara: ${message.to}\nAsunto: ${message.subject}\n\n${message.text}\n`
    );
    return { delivered: "console" };
  }
  try {
    client ??= new Resend(env.RESEND_API_KEY!.trim());
    const { data, error } = await client.emails.send(
      { from: env.EMAIL_FROM!.trim(), to: message.to, subject: message.subject, html: message.html, text: message.text },
      message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined
    );
    if (error || !data) throw new Error(error?.message ?? "Resend no devolvió un id");
    return { delivered: "resend", id: data.id };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[email] No se pudo enviar "${message.subject}" a ${message.to}: ${reason}`);
    return { delivered: "failed", error: reason };
  }
}
