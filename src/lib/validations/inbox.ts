import { z } from "zod";
import { CONTACT_TOPICS } from "./contact-options";
import { dateParam, first, pageOf, textParam, type SearchParams } from "./admin";

/*
 * Inputs of the admin's inbox (/admin/mensajes) and newsletter list
 * (/admin/newsletter), and of the public newsletter sign-up on the server.
 * Anything invalid in a list's search params falls back to "no filter".
 */

/** "inbox": new and read (not archived), the default. */
export const MESSAGE_VIEWS = ["inbox", "NEW", "READ", "ARCHIVED", "all"] as const;
export type MessageView = (typeof MESSAGE_VIEWS)[number];

export interface AdminMessageFilters {
  view: MessageView;
  /** Part of the name, email, order number or text. */
  q: string;
  topic: string;
  from: string;
  to: string;
  page: number;
}

const TOPIC_VALUES = CONTACT_TOPICS.map((topic) => topic.value) as string[];

export function parseMessageFilters(params: SearchParams): AdminMessageFilters {
  const view = first(params.view);
  const topic = first(params.topic);
  return {
    view: (MESSAGE_VIEWS as readonly string[]).includes(view) ? (view as MessageView) : "inbox",
    q: textParam(first(params.q), 120),
    topic: TOPIC_VALUES.includes(topic) ? topic : "",
    from: dateParam(first(params.from)),
    to: dateParam(first(params.to)),
    page: pageOf(first(params.page)),
  };
}

/** What an admin does to a message. */
export const messageStatusSchema = z.object({
  id: z.string().trim().min(1).max(64),
  status: z.enum(["NEW", "READ", "ARCHIVED"]),
});

export const SUBSCRIBER_STATUSES = ["active", "unsubscribed"] as const;

export interface AdminSubscriberFilters {
  q: string;
  status: (typeof SUBSCRIBER_STATUSES)[number] | "";
  page: number;
}

export function parseSubscriberFilters(params: SearchParams): AdminSubscriberFilters {
  const status = first(params.status);
  return {
    q: textParam(first(params.q), 254),
    status: (SUBSCRIBER_STATUSES as readonly string[]).includes(status) ? (status as AdminSubscriberFilters["status"]) : "",
    page: pageOf(first(params.page)),
  };
}

/** Where a sign-up came from (NewsletterSubscriber.source). */
export const NEWSLETTER_SOURCES = ["footer", "home", "checkout"] as const;

/**
 * What the sign-up answers every time, true for a new address (welcome
 * email), one that unsubscribed before (it stays out until its owner
 * confirms from the email) and one already on the list, without telling
 * which.
 */
export const NEWSLETTER_SIGNUP_DONE = "¡Listo! Revisa tu correo: si hace falta, te pedimos ahí que confirmes la suscripción.";

export const newsletterSignupSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Ingresa tu email").max(254, "Ingresa un email válido").pipe(z.email("Ingresa un email válido")),
  source: z.enum(NEWSLETTER_SOURCES).catch("footer"),
});

/** The unsubscribe link's token: the subscriber's id, a dot and its HMAC-SHA256 signature (base64url). */
export const unsubscribeTokenSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}\.[A-Za-z0-9_-]{43}$/);

/** The confirmation link's token: 32 random bytes, base64url. */
export const confirmTokenSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/);
