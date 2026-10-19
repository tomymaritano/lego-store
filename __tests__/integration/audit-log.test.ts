import { beforeAll, describe, expect, it } from "vitest";
import { recordAudit, searchAuditLog } from "@/lib/admin/audit";
import { formatOrderNumber } from "@/lib/orders/format";
import { parseAuditFilters } from "@/lib/validations/audit";
import { resetAndSeed, testDb } from "./setup/db";

/*
 * /admin/audit names the records its entries are about (order number, theme
 * name, email…) instead of their raw ids, and keeps the id when the record
 * is gone.
 */

const actor = { id: "", email: "auditoria@admin.test" };

beforeAll(async () => {
  await resetAndSeed();
  actor.id = (await testDb.user.create({ data: { email: actor.email, role: "ADMIN" }, select: { id: true } })).id;
});

describe("searchAuditLog", () => {
  it("names each entry's record when it still exists, and keeps the id of a deleted one", async () => {
    const order = await testDb.order.findFirstOrThrow({ select: { id: true, number: true } });
    const theme = await testDb.theme.findFirstOrThrow({ where: { slug: "star-wars" }, select: { id: true, name: true } });
    const customer = await testDb.user.create({ data: { email: "nombrada@audit.test" }, select: { id: true, email: true } });
    await recordAudit(testDb, actor, { action: "order.cancel", entityType: "order", entityId: order.id });
    await recordAudit(testDb, actor, { action: "theme.move", entityType: "theme", entityId: theme.id });
    await recordAudit(testDb, actor, { action: "user.block", entityType: "user", entityId: customer.id });
    await recordAudit(testDb, actor, { action: "product.delete", entityType: "product", entityId: "borrado-hace-tiempo" });
    await recordAudit(testDb, actor, { action: "export.orders", entityType: "export", entityId: "orders" });

    const page = await searchAuditLog(testDb, parseAuditFilters({ actor: actor.email }));
    const labelOf = (entityId: string) => page.items.find((entry) => entry.entityId === entityId)?.entityLabel;
    expect(labelOf(order.id)).toBe(formatOrderNumber(order.number));
    expect(labelOf(theme.id)).toBe(theme.name);
    expect(labelOf(customer.id)).toBe(customer.email);
    expect(labelOf("borrado-hace-tiempo")).toBeNull();
    expect(labelOf("orders")).toBeNull();
  });
});
