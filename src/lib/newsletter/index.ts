import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "@/lib/lists/product";
import { maskEmail } from "@/lib/email/mask";
import { pageCount, type Page } from "@/lib/admin/format";
import { ADMIN_PAGE_SIZE } from "@/lib/validations/admin";
import type { AdminSubscriberFilters } from "@/lib/validations/inbox";

/*
 * Newsletter subscribers (NewsletterSubscriber): sign-up from the footer,
 * unsubscribe from the link in every newsletter email
 * (/newsletter/baja?token=...), and the admin's list and export.
 *
 * The link's token is 32 random bytes; only its sha256 is stored, so the
 * database alone cannot unsubscribe anyone. Every (re)subscription issues a
 * new one. Signing up an address that is already subscribed changes
 * nothing and sends nothing (the form says the same either way, so it does
 * not tell who is subscribed).
 */

export const hashUnsubscribeToken = (token: string) => createHash("sha256").update(token).digest("base64url");

const newToken = () => randomBytes(32).toString("base64url");

export type SubscribeOutcome =
  /** New, or back after unsubscribing: `token` goes in the welcome email's unsubscribe link. */
  | { status: "subscribed" | "resubscribed"; token: string }
  | { status: "already" };

export async function subscribe(db: Db, { email, source, ip = null }: { email: string; source: string; ip?: string | null }): Promise<SubscribeOutcome> {
  const address = email.trim().toLowerCase();
  const token = newToken();
  const tokenHash = hashUnsubscribeToken(token);
  const existing = await db.newsletterSubscriber.findUnique({ where: { email: address }, select: { unsubscribedAt: true } });
  if (existing && !existing.unsubscribedAt) return { status: "already" };
  if (existing) {
    await db.newsletterSubscriber.update({
      where: { email: address },
      data: { unsubscribedAt: null, subscribedAt: new Date(), source, ip, unsubscribeTokenHash: tokenHash },
    });
    return { status: "resubscribed", token };
  }
  try {
    await db.newsletterSubscriber.create({ data: { email: address, source, ip, unsubscribeTokenHash: tokenHash } });
  } catch (error) {
    // Two sign-ups of the same address at once: the other one won.
    if ((error as { code?: string }).code === "P2002") return { status: "already" };
    throw error;
  }
  return { status: "subscribed", token };
}

export { maskEmail };

export type TokenLookup = { found: false } | { found: true; email: string; active: boolean };

export async function findByUnsubscribeToken(db: Db, token: string): Promise<TokenLookup> {
  const row = await db.newsletterSubscriber.findUnique({ where: { unsubscribeTokenHash: hashUnsubscribeToken(token) }, select: { email: true, unsubscribedAt: true } });
  return row ? { found: true, email: maskEmail(row.email), active: row.unsubscribedAt === null } : { found: false };
}

export type UnsubscribeOutcome = "unsubscribed" | "already" | "invalid";

export async function unsubscribeByToken(db: Db, token: string): Promise<UnsubscribeOutcome> {
  const tokenHash = hashUnsubscribeToken(token);
  const { count } = await db.newsletterSubscriber.updateMany({ where: { unsubscribeTokenHash: tokenHash, unsubscribedAt: null }, data: { unsubscribedAt: new Date() } });
  if (count > 0) return "unsubscribed";
  const row = await db.newsletterSubscriber.findUnique({ where: { unsubscribeTokenHash: tokenHash }, select: { id: true } });
  return row ? "already" : "invalid";
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

const subscriberSelect = { id: true, email: true, source: true, subscribedAt: true, unsubscribedAt: true } as const;

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
    items: rows.map((row) => ({ ...row, subscribedAt: row.subscribedAt.toISOString(), unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null })),
    total,
    page,
    totalPages,
    active,
  };
}
