import { createHash, randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Db } from "@/lib/lists/product";
import { recordAudit, type AuditActor } from "@/lib/admin/audit";
import { signPayload, verifyPayload } from "@/lib/auth/signing";
import { siteUrl } from "@/lib/email/contact";
import { maskEmail } from "@/lib/email/mask";
import { pageCount, type Page } from "@/lib/admin/format";
import { ADMIN_PAGE_SIZE } from "@/lib/validations/admin";
import type { AdminSubscriberFilters } from "@/lib/validations/inbox";

/*
 * Newsletter subscribers (NewsletterSubscriber): sign-up from the footer,
 * unsubscribe from the link in every newsletter email
 * (/newsletter/baja?token=...), and the admin's list, export and
 * "Dar de baja".
 *
 * The unsubscribe link's token is "<id>.<signature>": the subscriber's id
 * signed with AUTH_SECRET (src/lib/auth/signing.ts, with its own purpose).
 * Nothing about it is stored, so it can be rebuilt for any email at any time
 * (unsubscribeUrl(): the welcome email, any later send, the export's
 * "Enlace de baja" column for a mailing tool), and it stays the same across
 * a re-subscription, so an old email's link keeps working. It only
 * unsubscribes, and only that address. Without AUTH_SECRET there is no link
 * (and no sign-in either: Auth.js fails closed).
 *
 * Signing up an address that is already subscribed changes nothing and
 * sends nothing (the form says the same either way, so it does not tell who
 * is subscribed).
 *
 * An address that unsubscribed stays unsubscribed until its owner says
 * otherwise: signing it up again only sends a "confirm" email with its own
 * random token (/newsletter/confirmar?token=..., only its sha256 stored,
 * valid RESUBSCRIBE_TTL_MS, at most one email per address per
 * RESUBSCRIBE_RESEND_MS), and the button on that page is what subscribes it
 * again. Anyone can type someone else's address in the footer; that must
 * not undo their opt-out.
 */

/** sha256 (base64url) of a confirmation link's token, as resubscribeTokenHash stores it. */
export const hashConfirmToken = (token: string) => createHash("sha256").update(token).digest("base64url");

const newToken = () => randomBytes(32).toString("base64url");

const UNSUBSCRIBE_PURPOSE = "newsletter-unsubscribe";

/** The token of a subscriber's unsubscribe link, or null without AUTH_SECRET. */
export function unsubscribeToken(subscriberId: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const signature = signPayload(UNSUBSCRIBE_PURPOSE, subscriberId, env);
  return signature ? `${subscriberId}.${signature}` : null;
}

/** The unsubscribe link for any email to this subscriber, or null without AUTH_SECRET. */
export function unsubscribeUrl(subscriberId: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const token = unsubscribeToken(subscriberId, env);
  return token ? siteUrl(`/newsletter/baja?token=${encodeURIComponent(token)}`) : null;
}

/** The subscriber id an unsubscribe token names, when its signature is right. */
function subscriberIdOf(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  return verifyPayload(UNSUBSCRIBE_PURPOSE, id, token.slice(dot + 1)) ? id : null;
}

/** How long a "confirm your subscription" link works. */
export const RESUBSCRIBE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** A new confirmation email for the same address goes out at most this often. */
export const RESUBSCRIBE_RESEND_MS = 24 * 60 * 60 * 1000;

export type SubscribeOutcome =
  /** New: the welcome email carries the unsubscribe link of `id`. */
  | { status: "subscribed"; id: string }
  /** Unsubscribed before: `token` goes in the confirmation email; the row stays unsubscribed. */
  | { status: "confirm"; token: string }
  /** Already subscribed, or a confirmation already sent recently: nothing to send. */
  | { status: "already" };

export async function subscribe(
  db: Db,
  { email, source, ip = null, now = new Date() }: { email: string; source: string; ip?: string | null; now?: Date },
): Promise<SubscribeOutcome> {
  const address = email.trim().toLowerCase();
  const existing = await db.newsletterSubscriber.findUnique({
    where: { email: address },
    select: { unsubscribedAt: true, resubscribeRequestedAt: true },
  });
  if (existing && !existing.unsubscribedAt) return { status: "already" };
  if (existing) {
    const recent = existing.resubscribeRequestedAt && now.getTime() - existing.resubscribeRequestedAt.getTime() < RESUBSCRIBE_RESEND_MS;
    if (recent) return { status: "already" };
    const token = newToken();
    // Only the pending confirmation changes; source and ip are the confirmer's to set.
    await db.newsletterSubscriber.update({
      where: { email: address },
      data: {
        resubscribeTokenHash: hashConfirmToken(token),
        resubscribeRequestedAt: now,
      },
    });
    return { status: "confirm", token };
  }
  try {
    const { id } = await db.newsletterSubscriber.create({
      data: { email: address, source, ip },
      select: { id: true },
    });
    return { status: "subscribed", id };
  } catch (error) {
    // Two sign-ups of the same address at once: the other one won.
    if ((error as { code?: string }).code === "P2002") return { status: "already" };
    throw error;
  }
}

export type ResubscribeLookup = { found: false } | { found: true; email: string };

/** The confirmation page: whose link it is, if it is pending and not expired. */
export async function findByResubscribeToken(db: Db, token: string, now = new Date()): Promise<ResubscribeLookup> {
  const row = await db.newsletterSubscriber.findUnique({
    where: { resubscribeTokenHash: hashConfirmToken(token) },
    select: { email: true, unsubscribedAt: true, resubscribeRequestedAt: true },
  });
  if (!row?.unsubscribedAt || !row.resubscribeRequestedAt || now.getTime() - row.resubscribeRequestedAt.getTime() > RESUBSCRIBE_TTL_MS) return { found: false };
  return { found: true, email: maskEmail(row.email) };
}

export type ConfirmOutcome =
  /** Subscribed again: the welcome email goes to `email`, with the unsubscribe link of `id`. */
  { status: "confirmed"; email: string; id: string } | { status: "invalid" };

/** The confirmation page's button: subscribes the address again, once (its unsubscribe link stays the same). */
export async function confirmResubscribe(db: Db, token: string, { ip = null, now = new Date() }: { ip?: string | null; now?: Date } = {}): Promise<ConfirmOutcome> {
  const resubscribeTokenHash = hashConfirmToken(token);
  const row = await db.newsletterSubscriber.findUnique({
    where: { resubscribeTokenHash },
    select: { id: true, email: true },
  });
  if (!row) return { status: "invalid" };
  const { count } = await db.newsletterSubscriber.updateMany({
    where: {
      resubscribeTokenHash,
      unsubscribedAt: { not: null },
      resubscribeRequestedAt: {
        gte: new Date(now.getTime() - RESUBSCRIBE_TTL_MS),
      },
    },
    data: {
      unsubscribedAt: null,
      subscribedAt: now,
      ip,
      resubscribeTokenHash: null,
      resubscribeRequestedAt: null,
    },
  });
  return count > 0 ? { status: "confirmed", email: row.email, id: row.id } : { status: "invalid" };
}

export { maskEmail };

export type TokenLookup = { found: false } | { found: true; email: string; active: boolean };

export async function findByUnsubscribeToken(db: Db, token: string): Promise<TokenLookup> {
  const id = subscriberIdOf(token);
  const row = id
    ? await db.newsletterSubscriber.findUnique({
        where: { id },
        select: { email: true, unsubscribedAt: true },
      })
    : null;
  return row
    ? {
        found: true,
        email: maskEmail(row.email),
        active: row.unsubscribedAt === null,
      }
    : { found: false };
}

export type UnsubscribeOutcome = "unsubscribed" | "already" | "invalid";

async function unsubscribeById(db: Db, id: string, now: Date): Promise<UnsubscribeOutcome> {
  const { count } = await db.newsletterSubscriber.updateMany({
    where: { id, unsubscribedAt: null },
    data: { unsubscribedAt: now },
  });
  if (count > 0) return "unsubscribed";
  const row = await db.newsletterSubscriber.findUnique({
    where: { id },
    select: { id: true },
  });
  return row ? "already" : "invalid";
}

/** The unsubscribe page's button. */
export async function unsubscribeByToken(db: Db, token: string, now = new Date()): Promise<UnsubscribeOutcome> {
  const id = subscriberIdOf(token);
  return id ? unsubscribeById(db, id, now) : "invalid";
}

/**
 * The admin's "Dar de baja" (someone asked by email, by phone, or replied
 * "baja"): the same as the link, recorded in the audit log in the same
 * transaction.
 */
export function unsubscribeAsAdmin(db: PrismaClient, actor: AuditActor, id: string, now = new Date()): Promise<UnsubscribeOutcome> {
  return db.$transaction(async (tx) => {
    const outcome = await unsubscribeById(tx, id, now);
    if (outcome === "unsubscribed") {
      await recordAudit(tx, actor, {
        action: "subscriber.unsubscribe",
        entityType: "subscriber",
        entityId: id,
        changes: { unsubscribedAt: [null, now.toISOString()] },
      });
    }
    return outcome;
  });
}

// ---------------------------------------------------------------------------
// The admin's list (/admin/newsletter) and export
// ---------------------------------------------------------------------------

export interface AdminSubscriberRow {
  id: string;
  email: string;
  source: string;
  subscribedAt: string;
  unsubscribedAt: string | null;
}

export function subscriberWhere(filters: Pick<AdminSubscriberFilters, "q" | "status">): Prisma.NewsletterSubscriberWhereInput {
  const and: Prisma.NewsletterSubscriberWhereInput[] = [];
  if (filters.q) and.push({ email: { contains: filters.q.toLowerCase() } });
  if (filters.status === "active") and.push({ unsubscribedAt: null });
  if (filters.status === "unsubscribed") and.push({ unsubscribedAt: { not: null } });
  return { AND: and };
}

const subscriberSelect = {
  id: true,
  email: true,
  source: true,
  subscribedAt: true,
  unsubscribedAt: true,
} as const;

export async function listSubscribers(db: Db, filters: AdminSubscriberFilters): Promise<Page<AdminSubscriberRow> & { active: number }> {
  const where = subscriberWhere(filters);
  const [total, active] = await Promise.all([db.newsletterSubscriber.count({ where }), db.newsletterSubscriber.count({ where: { unsubscribedAt: null } })]);
  const totalPages = pageCount(total);
  const page = Math.min(filters.page, totalPages);
  const rows = await db.newsletterSubscriber.findMany({
    where,
    orderBy: [{ subscribedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: subscriberSelect,
  });
  return {
    items: rows.map((row) => ({
      ...row,
      subscribedAt: row.subscribedAt.toISOString(),
      unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null,
    })),
    total,
    page,
    totalPages,
    active,
  };
}
