import { describe, expect, it } from "vitest";
import { diffFields, snapshotFields } from "@/lib/admin/audit";
import { auditEntityHref, describeAuditChanges } from "@/lib/admin/audit-format";
import { formatPrice } from "@/lib/utils";
import { parseAuditFilters } from "@/lib/validations/audit";

describe("audit entries", () => {
  it("diffFields keeps only what changed, lists and dates included", () => {
    const at = new Date("2026-10-18T12:00:00Z");
    expect(
      diffFields(
        { name: "A", price: 10, images: ["/a.png"], startsAt: null, active: true },
        { name: "A", price: 12, images: ["/a.png", "/b.png"], startsAt: at, active: true }
      )
    ).toEqual({ price: [10, 12], images: [["/a.png"], ["/a.png", "/b.png"]], startsAt: [null, at.toISOString()] });
    expect(diffFields({ images: ["/a.png"] }, { images: ["/a.png"] })).toEqual({});
  });

  it("snapshotFields keeps every value as JSON", () => {
    expect(snapshotFields({ a: undefined, b: new Date("2026-01-01T00:00:00Z"), c: ["x"] })).toEqual({ a: null, b: "2026-01-01T00:00:00.000Z", c: ["x"] });
  });

  it("describes an edit field by field, and a creation by its summary", () => {
    expect(describeAuditChanges({ action: "product.update", entityType: "product", changes: { price: [1500, 1299], isNew: [true, false], description: ["a", "b"] } })).toEqual([
      `precio: ${formatPrice(1500)} → ${formatPrice(1299)}`,
      "nuevo: sí → no",
      "descripción: cambió",
    ]);
    expect(describeAuditChanges({ action: "order.cancel", entityType: "order", changes: { status: ["PAID", "CANCELLED"], refundId: "re_1" } })).toEqual([
      "estado: Pagado → Cancelado",
      "reembolso: re_1",
    ]);
    expect(describeAuditChanges({ action: "user.role", entityType: "user", changes: { role: ["USER", "ADMIN"] } })).toEqual(["rol: Cliente → Admin"]);
    // A creation's images are a list, not [before, after].
    expect(
      describeAuditChanges({ action: "product.create", entityType: "product", changes: { name: "Torre", images: ["/a.png", "/b.png"], stock: 3 } })
    ).toEqual(["nombre: Torre", "stock: 3"]);
    expect(describeAuditChanges({ action: "coupon.update", entityType: "coupon", changes: { description: ["a", "b"] } })).toEqual(["nota: cambió"]);
  });

  it("links each record to its admin page", () => {
    expect(auditEntityHref("product", "14")).toBe("/admin/products/14");
    expect(auditEntityHref("user", "u 1")).toBe("/admin/users/u%201");
    expect(auditEntityHref("review", "r1")).toBeNull();
  });

  it("parses the filters, dropping anything invalid", () => {
    expect(parseAuditFilters({ actor: " Jefa@X.com ", entity: "product", from: "2026-10-01", to: "nope", action: "product.update", page: "2" })).toEqual({
      actor: "Jefa@X.com",
      entity: "product",
      entityId: "",
      action: "product.update",
      from: "2026-10-01",
      to: "",
      page: 2,
    });
    expect(parseAuditFilters({ entity: "planet", action: "DROP TABLE" })).toMatchObject({ entity: "", action: "" });
  });
});
