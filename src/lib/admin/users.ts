import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { escapeLike } from "@/lib/api/search";
import type { Db } from "@/lib/lists/product";
import type { OrderStatus } from "@/lib/orders/types";
import { ADMIN_PAGE_SIZE } from "@/lib/validations/admin";
import type { AdminUserFilters, UserRole } from "@/lib/validations/users";
import { listActorEntries, listAuditEntries, recordAudit, type AuditActor, type AuditEntryView } from "./audit";
import { COLLECTED } from "./dashboard";
import { pageCount, storeDayEnd, storeDayStart, type Page } from "./format";

/*
 * The admin's accounts (/admin/users): the list with what each customer
 * ordered and spent, one account with its orders, reviews and the addresses
 * it shipped to, and the two things an admin changes: the role (USER /
 * ADMIN) and blocking. Client first, like the rest of the admin's server
 * code; no permission checks here (./data.ts and ./actions.ts check the
 * admin first). Every write records its AuditLog entry in the same
 * transaction.
 *
 * Rules that keep the store administrable:
 * - an admin never changes their own role or blocks themselves;
 * - the last active (unblocked) admin cannot be demoted or blocked.
 * Both writes lock every ADMIN row first, so two admins demoting each
 * other at the same moment cannot leave the store without one.
 *
 * Blocking ends the account's sessions (sessionVersion + 1, as a password
 * change does) and refuses its logins, by password or Google
 * (src/lib/auth). Orders, reviews and lists are kept; unblocking only lets
 * the owner sign in again.
 */

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  blocked: boolean;
  createdAt: string;
  /** Placed orders ("Realizar pedido"). */
  orders: number;
  /** What the store kept: paid, shipped and delivered orders. */
  spent: number;
}

const rowSelect = { id: true, name: true, email: true, role: true, blockedAt: true, createdAt: true } as const satisfies Prisma.UserSelect;

function userWhere(filters: AdminUserFilters): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];
  const q = filters.q.trim();
  if (q) {
    and.push({ OR: [{ email: { contains: escapeLike(q.toLowerCase()) } }, { name: { contains: escapeLike(q), mode: "insensitive" } }, { id: q }] });
  }
  if (filters.role) and.push({ role: filters.role });
  if (filters.status === "active") and.push({ blockedAt: null });
  if (filters.status === "blocked") and.push({ blockedAt: { not: null } });
  if (filters.from) and.push({ createdAt: { gte: storeDayStart(filters.from) } });
  if (filters.to) and.push({ createdAt: { lt: storeDayEnd(filters.to) } });
  return { AND: and };
}

/** Orders placed and money kept per user, for these users. */
async function orderStats(db: Db, userIds: string[]): Promise<Map<string, { orders: number; spent: number }>> {
  const stats = new Map<string, { orders: number; spent: number }>();
  if (userIds.length === 0) return stats;
  const [placed, collected] = await Promise.all([
    db.order.groupBy({ by: ["userId"], where: { userId: { in: userIds }, submittedAt: { not: null } }, _count: { _all: true } }),
    db.order.groupBy({ by: ["userId"], where: { userId: { in: userIds }, status: { in: COLLECTED } }, _sum: { total: true } }),
  ]);
  for (const id of userIds) stats.set(id, { orders: 0, spent: 0 });
  for (const row of placed) if (row.userId) stats.get(row.userId)!.orders = row._count._all;
  for (const row of collected) if (row.userId) stats.get(row.userId)!.spent = row._sum.total ?? 0;
  return stats;
}

/** Accounts newest first, filtered by name / email, role, status and sign-up date, a page at a time. */
export async function listAdminUsers(db: Db, filters: AdminUserFilters): Promise<Page<AdminUserRow>> {
  const where = userWhere(filters);
  const total = await db.user.count({ where });
  const totalPages = pageCount(total);
  const page = Math.min(filters.page, totalPages);
  const rows = await db.user.findMany({
    where,
    select: rowSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
  });
  const stats = await orderStats(
    db,
    rows.map((row) => row.id)
  );
  return {
    items: rows.map(({ blockedAt, createdAt, ...row }) => ({
      ...row,
      blocked: blockedAt !== null,
      createdAt: createdAt.toISOString(),
      ...(stats.get(row.id) ?? { orders: 0, spent: 0 }),
    })),
    total,
    page,
    totalPages,
  };
}

export interface AdminUserOrder {
  id: string;
  number: number;
  status: OrderStatus;
  total: number;
  itemCount: number;
  placedAt: string;
}

export interface AdminUserReview {
  id: string;
  rating: number;
  title: string;
  createdAt: string;
  product: { id: string; name: string };
}

export interface ShippingAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  /** How many of the account's orders went there, and the last time. */
  orders: number;
  lastUsedAt: string;
}

export interface AdminUserDetail extends AdminUserRow {
  blockedAt: string | null;
  blockedReason: string | null;
  emailVerified: string | null;
  hasPassword: boolean;
  /** Sign-in providers linked to the account ("google"). */
  providers: string[];
  recentOrders: AdminUserOrder[];
  /** The latest reviews (at most USER_DETAIL_LIMIT); reviewCount counts them all. */
  reviews: AdminUserReview[];
  reviewCount: number;
  addresses: ShippingAddress[];
  /** Changes made to this account (role, block). */
  history: AuditEntryView[];
  /** What this account did as an admin. */
  adminActions: AuditEntryView[];
  /** The account is the only unblocked admin: it can be neither demoted nor blocked. */
  lastActiveAdmin: boolean;
}

/** Most orders and reviews a user's page lists (the newest); the counts cover all of them. */
export const USER_DETAIL_LIMIT = 50;

/** How many unblocked admins there are, `except` one. */
const activeAdminsExcept = (db: Db, except: string) => db.user.count({ where: { role: "ADMIN", blockedAt: null, id: { not: except } } });

export async function getAdminUser(db: Db, id: string): Promise<AdminUserDetail | null> {
  const user = await db.user.findUnique({
    where: { id },
    select: { ...rowSelect, blockedReason: true, emailVerified: true, passwordHash: true, accounts: { select: { provider: true } } },
  });
  if (!user) return null;
  const [stats, orders, reviews, reviewCount, history, adminActions, otherAdmins] = await Promise.all([
    orderStats(db, [id]),
    db.order.findMany({
      where: { userId: id, submittedAt: { not: null } },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: USER_DETAIL_LIMIT,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        submittedAt: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        items: { select: { quantity: true } },
      },
    }),
    db.review.findMany({
      where: { userId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: USER_DETAIL_LIMIT,
      select: { id: true, rating: true, title: true, createdAt: true, product: { select: { id: true, name: true } } },
    }),
    db.review.count({ where: { userId: id } }),
    listAuditEntries(db, "user", id),
    user.role === "ADMIN" ? listActorEntries(db, id) : Promise.resolve([]),
    activeAdminsExcept(db, id),
  ]);

  // The addresses its orders shipped to, most used first (an address is its whole snapshot).
  const addresses = new Map<string, ShippingAddress>();
  for (const order of orders) {
    const entry = {
      name: `${order.firstName} ${order.lastName}`.trim(),
      phone: order.phone,
      address: order.address,
      city: order.city,
      state: order.state,
      zipCode: order.zipCode,
      country: order.country,
    };
    const key = JSON.stringify([entry.address, entry.city, entry.state, entry.zipCode, entry.country].map((part) => part.trim().toLowerCase()));
    const known = addresses.get(key);
    if (known) known.orders += 1;
    else addresses.set(key, { ...entry, orders: 1, lastUsedAt: order.submittedAt!.toISOString() });
  }

  const { blockedAt, createdAt, passwordHash, accounts, blockedReason, emailVerified, ...row } = user;
  return {
    ...row,
    blocked: blockedAt !== null,
    blockedAt: blockedAt?.toISOString() ?? null,
    blockedReason,
    emailVerified: emailVerified?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
    hasPassword: passwordHash !== null,
    providers: Array.from(new Set(accounts.map((account) => account.provider))),
    ...(stats.get(id) ?? { orders: 0, spent: 0 }),
    recentOrders: orders.map((order) => ({
      id: order.id,
      number: order.number,
      status: order.status as OrderStatus,
      total: order.total,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      placedAt: order.submittedAt!.toISOString(),
    })),
    reviews: reviews.map((review) => ({ ...review, createdAt: review.createdAt.toISOString() })),
    reviewCount,
    addresses: Array.from(addresses.values()).sort((a, b) => b.orders - a.orders || b.lastUsedAt.localeCompare(a.lastUsedAt)),
    history,
    adminActions,
    lastActiveAdmin: user.role === "ADMIN" && blockedAt === null && otherAdmins === 0,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type UserWriteResult =
  | { ok: true; changed: boolean }
  | { ok: false; reason: "not_found" }
  /** The admin tried it on their own account. */
  | { ok: false; reason: "self" }
  /** It would leave the store without an unblocked admin. */
  | { ok: false; reason: "last_admin" };

type Tx = Prisma.TransactionClient;

/**
 * Locks the target and every admin row (in id order, so concurrent writes
 * never deadlock), then reads the target. Under these locks the count of
 * other active admins cannot change until the transaction ends.
 */
async function lockForRoleRules(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "role" = 'ADMIN' OR "id" = ${id} ORDER BY "id" FOR UPDATE`;
  return tx.user.findUnique({ where: { id }, select: { id: true, email: true, role: true, blockedAt: true } });
}

/** Makes the account an admin or a customer. The role is read from the database on every request, so it applies at once. */
export function setUserRole(db: PrismaClient, actor: AuditActor, id: string, role: UserRole): Promise<UserWriteResult> {
  return db.$transaction(async (tx): Promise<UserWriteResult> => {
    if (id === actor.id) return { ok: false, reason: "self" };
    const user = await lockForRoleRules(tx, id);
    if (!user) return { ok: false, reason: "not_found" };
    if (user.role === role) return { ok: true, changed: false };
    if (user.role === "ADMIN" && user.blockedAt === null && (await activeAdminsExcept(tx, id)) === 0) return { ok: false, reason: "last_admin" };
    await tx.user.update({ where: { id }, data: { role } });
    await recordAudit(tx, actor, { action: "user.role", entityType: "user", entityId: id, changes: { role: [user.role, role] } });
    return { ok: true, changed: true };
  });
}

/**
 * Blocks (with an optional note) or unblocks the account. Blocking also
 * bumps its session version: every session it has ends on its next request.
 */
export function setUserBlocked(
  db: PrismaClient,
  actor: AuditActor,
  id: string,
  blocked: boolean,
  reason: string | null = null
): Promise<UserWriteResult> {
  return db.$transaction(async (tx): Promise<UserWriteResult> => {
    if (id === actor.id) return { ok: false, reason: "self" };
    const user = await lockForRoleRules(tx, id);
    if (!user) return { ok: false, reason: "not_found" };
    if ((user.blockedAt !== null) === blocked) return { ok: true, changed: false };
    if (blocked) {
      if (user.role === "ADMIN" && (await activeAdminsExcept(tx, id)) === 0) return { ok: false, reason: "last_admin" };
      await tx.user.update({ where: { id }, data: { blockedAt: new Date(), blockedReason: reason, sessionVersion: { increment: 1 } } });
      await recordAudit(tx, actor, { action: "user.block", entityType: "user", entityId: id, changes: { blocked: [false, true], ...(reason ? { reason } : {}) } });
    } else {
      await tx.user.update({ where: { id }, data: { blockedAt: null, blockedReason: null } });
      await recordAudit(tx, actor, { action: "user.unblock", entityType: "user", entityId: id, changes: { blocked: [true, false] } });
    }
    return { ok: true, changed: true };
  });
}

