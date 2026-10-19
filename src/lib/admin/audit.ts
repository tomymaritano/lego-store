import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "@/lib/lists/product";
import { ADMIN_PAGE_SIZE } from "@/lib/validations/admin";
import { AUDIT_ENTITY_TYPES, type AuditEntityType, type AuditFilters } from "@/lib/validations/audit";
import { formatOrderNumber } from "@/lib/orders/format";
import { pageCount, storeDayEnd, storeDayStart, type Page } from "./format";

/*
 * The admin's audit log (AuditLog): who did what to which record, when and
 * from where. Every admin mutation (products, orders, reviews, coupons,
 * users, categories, themes, uploads) writes its entry in the same
 * transaction as the change, so there is never a change without its entry
 * (or the other way around). Order status changes also keep their own trail
 * (OrderStatusChange), which the order page's timeline reads.
 *
 * Actions are "<entity>.<verb>" ("product.update", "user.block"); the entity
 * types are AUDIT_ENTITY_TYPES. `changes` is { field: [before, after] } for
 * an edit and the new values for a creation (snapshotFields).
 */

export interface AuditActor {
  id: string;
  email: string;
  /** Where the request came from (src/lib/admin/actor.ts); null when no proxy is trusted. */
  ip?: string | null;
}

export { AUDIT_ENTITY_TYPES, type AuditEntityType };

type JsonValue = string | number | boolean | null | JsonValue[];

/** { field: [before, after] } for the fields that changed (dates as ISO strings). */
export type AuditChanges = Record<string, [JsonValue, JsonValue] | JsonValue>;

const plain = (value: unknown): JsonValue => {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(plain);
  return value as JsonValue;
};

const same = (a: JsonValue, b: JsonValue) => JSON.stringify(a) === JSON.stringify(b);

/** The fields of `after` whose value differs from `before`'s, as [before, after]. */
export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>): AuditChanges {
  const changes: AuditChanges = {};
  for (const key of Object.keys(after)) {
    const from = plain(before[key]);
    const to = plain(after[key]);
    if (!same(from, to)) changes[key] = [from, to];
  }
  return changes;
}

/** The values of a record as an entry's `changes` (a creation). */
export function snapshotFields(values: Record<string, unknown>): AuditChanges {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, plain(value)]));
}

export interface AuditEntryInput {
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  changes?: AuditChanges | null;
}

export async function recordAudit(db: Db, actor: AuditActor, entry: AuditEntryInput): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email.trim().toLowerCase(),
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changes: (entry.changes ?? undefined) as Prisma.InputJsonValue | undefined,
      ip: actor.ip ?? null,
    },
  });
}

export interface AuditEntryView {
  id: string;
  action: string;
  actorId: string | null;
  actorEmail: string;
  entityType: string;
  entityId: string;
  changes: AuditChanges | null;
  ip: string | null;
  at: string;
}

const entrySelect = {
  id: true,
  action: true,
  actorId: true,
  actorEmail: true,
  entityType: true,
  entityId: true,
  changes: true,
  ip: true,
  createdAt: true,
} as const satisfies Prisma.AuditLogSelect;

type EntryRow = Prisma.AuditLogGetPayload<{ select: typeof entrySelect }>;

const toView = ({ createdAt, changes, ...row }: EntryRow): AuditEntryView => ({
  ...row,
  changes: (changes as AuditChanges | null) ?? null,
  at: createdAt.toISOString(),
});

/** How many entries a detail page's history panel shows (src/components/admin/AuditHistory.tsx); the rest are in /admin/audit. */
export const AUDIT_PANEL_SIZE = 8;

/**
 * A record's entries, newest first (the history panels of the detail pages):
 * one more than the panel shows, so it can tell there are older ones.
 */
export async function listAuditEntries(db: Db, entityType: AuditEntityType, entityId: string, take = AUDIT_PANEL_SIZE + 1): Promise<AuditEntryView[]> {
  const rows = await db.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: entrySelect,
  });
  return rows.map(toView);
}

/** What an admin did (the user page's "Acciones como admin"), newest first. */
export async function listActorEntries(db: Db, actorId: string, take = AUDIT_PANEL_SIZE + 1): Promise<AuditEntryView[]> {
  const rows = await db.auditLog.findMany({
    where: { actorId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: entrySelect,
  });
  return rows.map(toView);
}

function auditWhere(filters: AuditFilters): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (filters.actor) and.push({ actorEmail: { contains: filters.actor.toLowerCase() } });
  if (filters.entity) and.push({ entityType: filters.entity });
  if (filters.entityId) and.push({ entityId: filters.entityId });
  if (filters.action) and.push({ action: { startsWith: filters.action } });
  if (filters.from) and.push({ createdAt: { gte: storeDayStart(filters.from) } });
  if (filters.to) and.push({ createdAt: { lt: storeDayEnd(filters.to) } });
  return { AND: and };
}

/** /admin/audit: every entry matching the filters, newest first, a page at a time. */
/** An entry of the full log, with a readable name for its record when it still exists. */
export interface AuditLogEntry extends AuditEntryView {
  /** "LEGO-001935" for an order, a theme's or product's name, a user's email…; null when there is none (or it was deleted). */
  entityLabel: string | null;
}

const labelKey = (entityType: string, entityId: string) => `${entityType}:${entityId}`;

/**
 * Readable names for the records a page of entries is about, one query per kind
 * of record: ids alone (cuids) say nothing to an admin, and the rest of the
 * panel names records by order number, name or email. A deleted record has no
 * name; the entry keeps its id.
 */
async function entityLabels(db: Db, rows: { entityType: string; entityId: string }[]): Promise<Map<string, string>> {
  const ids = (type: AuditEntityType) => [...new Set(rows.filter((row) => row.entityType === type).map((row) => row.entityId))];
  const labels = new Map<string, string>();
  const put = (type: AuditEntityType, found: { id: string; label: string }[]) => {
    for (const { id, label } of found) labels.set(labelKey(type, id), label);
  };
  const lookups: Promise<void>[] = [];
  const lookup = <T,>(type: AuditEntityType, query: (ids: string[]) => Promise<T[]>, toLabel: (row: T) => { id: string; label: string }) => {
    const wanted = ids(type);
    if (wanted.length > 0) lookups.push(query(wanted).then((found) => put(type, found.map(toLabel))));
  };
  lookup("order", (id) => db.order.findMany({ where: { id: { in: id } }, select: { id: true, number: true } }), (row) => ({ id: row.id, label: formatOrderNumber(row.number) }));
  lookup("product", (id) => db.product.findMany({ where: { id: { in: id } }, select: { id: true, name: true } }), (row) => ({ id: row.id, label: row.name }));
  lookup("coupon", (id) => db.coupon.findMany({ where: { id: { in: id } }, select: { id: true, code: true } }), (row) => ({ id: row.id, label: row.code }));
  lookup("user", (id) => db.user.findMany({ where: { id: { in: id } }, select: { id: true, email: true } }), (row) => ({ id: row.id, label: row.email }));
  lookup("category", (id) => db.category.findMany({ where: { id: { in: id } }, select: { id: true, name: true } }), (row) => ({ id: row.id, label: row.name }));
  lookup("theme", (id) => db.theme.findMany({ where: { id: { in: id } }, select: { id: true, name: true } }), (row) => ({ id: row.id, label: row.name }));
  lookup("message", (id) => db.contactMessage.findMany({ where: { id: { in: id } }, select: { id: true, email: true } }), (row) => ({ id: row.id, label: row.email }));
  lookup("subscriber", (id) => db.newsletterSubscriber.findMany({ where: { id: { in: id } }, select: { id: true, email: true } }), (row) => ({ id: row.id, label: row.email }));
  await Promise.all(lookups);
  return labels;
}

export async function searchAuditLog(db: Db, filters: AuditFilters): Promise<Page<AuditLogEntry>> {
  const where = auditWhere(filters);
  const total = await db.auditLog.count({ where });
  const totalPages = pageCount(total);
  const page = Math.min(filters.page, totalPages);
  const rows = await db.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: entrySelect,
  });
  const labels = await entityLabels(db, rows);
  const items = rows.map((row) => ({ ...toView(row), entityLabel: labels.get(labelKey(row.entityType, row.entityId)) ?? null }));
  return { items, total, page, totalPages };
}
