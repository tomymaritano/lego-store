import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Db } from "@/lib/lists/product";
import { recordAudit, type AuditActor } from "@/lib/admin/audit";
import { pageCount, storeDayEnd, storeDayStart, type Page } from "@/lib/admin/format";
import { ADMIN_PAGE_SIZE } from "@/lib/validations/admin";
import type { ContactInput } from "@/lib/validations/contact";
import type { AdminMessageFilters } from "@/lib/validations/inbox";

/*
 * Messages from the contact form (ContactMessage) and the admin's inbox
 * (/admin/mensajes). Client first; the public action (./actions.ts) rate
 * limits and validates, the admin's actions check the admin. Status
 * changes are audited ("message.read", "message.unread", "message.archive").
 */

export type MessageStatus = "NEW" | "READ" | "ARCHIVED";

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = { NEW: "Nuevo", READ: "Leído", ARCHIVED: "Archivado" };

export async function createContactMessage(db: Db, input: ContactInput, { userId = null, ip = null }: { userId?: string | null; ip?: string | null } = {}) {
  return db.contactMessage.create({
    data: {
      topic: input.topic,
      name: input.name,
      email: input.email.trim().toLowerCase(),
      orderNumber: input.orderNumber ? input.orderNumber.toUpperCase() : null,
      message: input.message,
      userId,
      ip,
    },
    select: { id: true, topic: true, name: true, email: true, orderNumber: true, message: true, createdAt: true },
  });
}

export interface AdminMessageRow {
  id: string;
  topic: string;
  name: string;
  email: string;
  orderNumber: string | null;
  /** The text, whole (the inbox shows a line of it). */
  message: string;
  status: MessageStatus;
  userId: string | null;
  createdAt: string;
  readAt: string | null;
}

const rowSelect = {
  id: true,
  topic: true,
  name: true,
  email: true,
  orderNumber: true,
  message: true,
  status: true,
  userId: true,
  createdAt: true,
  readAt: true,
} as const satisfies Prisma.ContactMessageSelect;

type Row = Prisma.ContactMessageGetPayload<{ select: typeof rowSelect }>;

const toRow = (row: Row): AdminMessageRow => ({ ...row, createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null });

function messageWhere(filters: AdminMessageFilters): Prisma.ContactMessageWhereInput {
  const and: Prisma.ContactMessageWhereInput[] = [];
  if (filters.view === "inbox") and.push({ status: { in: ["NEW", "READ"] } });
  else if (filters.view !== "all") and.push({ status: filters.view });
  if (filters.topic) and.push({ topic: filters.topic });
  if (filters.q) {
    const q = filters.q;
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q.toLowerCase() } },
        { orderNumber: { contains: q.toUpperCase() } },
        { message: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (filters.from) and.push({ createdAt: { gte: storeDayStart(filters.from) } });
  if (filters.to) and.push({ createdAt: { lt: storeDayEnd(filters.to) } });
  return { AND: and };
}

export async function listAdminMessages(db: Db, filters: AdminMessageFilters): Promise<Page<AdminMessageRow> & { unread: number }> {
  const where = messageWhere(filters);
  const [total, unread] = await Promise.all([db.contactMessage.count({ where }), db.contactMessage.count({ where: { status: "NEW" } })]);
  const totalPages = pageCount(total);
  const page = Math.min(filters.page, totalPages);
  const rows = await db.contactMessage.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: rowSelect,
  });
  return { items: rows.map(toRow), total, page, totalPages, unread };
}

export async function getAdminMessage(db: Db, id: string): Promise<AdminMessageRow | null> {
  const row = await db.contactMessage.findUnique({ where: { id }, select: rowSelect });
  return row ? toRow(row) : null;
}

const STATUS_ACTION: Record<MessageStatus, string> = { NEW: "message.unread", READ: "message.read", ARCHIVED: "message.archive" };

/**
 * Marks a message new (unread), read or archived. `changed` is false when
 * it already was (no entry then). Archiving keeps the read date.
 */
export function setMessageStatus(
  db: PrismaClient,
  actor: AuditActor,
  id: string,
  status: MessageStatus,
  now = new Date()
): Promise<{ ok: true; changed: boolean } | { ok: false }> {
  return db.$transaction(async (tx) => {
    const before = await tx.contactMessage.findUnique({ where: { id }, select: { status: true, readAt: true } });
    if (!before) return { ok: false };
    if (before.status === status) return { ok: true, changed: false };
    await tx.contactMessage.update({
      where: { id },
      data: {
        status,
        readAt: status === "NEW" ? null : (before.readAt ?? now),
        archivedAt: status === "ARCHIVED" ? now : null,
      },
    });
    await recordAudit(tx, actor, { action: STATUS_ACTION[status], entityType: "message", entityId: id, changes: { status: [before.status, status] } });
    return { ok: true, changed: true };
  });
}
