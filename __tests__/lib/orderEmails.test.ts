import { afterEach, describe, expect, it, vi } from "vitest";
import { orderCancelledEmail, orderConfirmationEmail, orderShippedEmail } from "@/lib/email/orders";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { ORDER_STATUS_LABELS, formatOrderNumber, orderTimeline, paymentLabel } from "@/lib/orders/format";
import { makeOrder } from "../helpers/orders";

describe("order emails", () => {
  it("confirmation: Spanish subject with the order number, lines, totals, address and card; no link for a guest", () => {
    const email = orderConfirmationEmail(makeOrder({ status: "PAID" }));
    expect(email.to).toBe("ana@example.com");
    expect(email.subject).toBe("Confirmamos tu pedido LEGO-001001");
    expect(email.idempotencyKey).toBe("order-paid/order_1");
    expect(email.html).toContain("¡Gracias por tu compra!");
    expect(email.html).toContain("Set 1");
    expect(email.html).toContain("Visa •••• 4242");
    expect(email.html).not.toContain("/account/orders/");
    expect(email.text).toContain("Set 1 × 2");
    expect(email.text).toMatch(/Total: \$\s?2\.746/);
  });

  it("links to the order page when the order belongs to an account", () => {
    const email = orderShippedEmail(makeOrder({ status: "SHIPPED", hasAccount: true }));
    expect(email.subject).toBe("Tu pedido LEGO-001001 está en camino");
    expect(email.html).toContain("/account/orders/order_1");
    expect(email.text).toContain("/account/orders/order_1");
  });

  it("cancellation: says the order was cancelled and how much is refunded, to which card", () => {
    const email = orderCancelledEmail(makeOrder({ status: "CANCELLED" }));
    expect(email.subject).toBe("Cancelamos tu pedido LEGO-001001");
    expect(email.idempotencyKey).toBe("order-cancelled/order_1");
    expect(email.html).toContain("Cancelamos tu pedido");
    expect(email.text).toMatch(/Te reembolsamos \$\s?2\.746/);
    expect(email.text).toContain("Visa •••• 4242");
  });

  it("escapes what customers typed", () => {
    const order = makeOrder();
    const email = orderConfirmationEmail({
      ...order,
      shippingAddress: { ...order.shippingAddress, firstName: '<img src=x onerror="alert(1)">' },
    });
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});

describe("sendEmail", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs to the console when Resend is not configured", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(isEmailConfigured({ RESEND_API_KEY: "re_1" })).toBe(false);
    const result = await sendEmail({ to: "ana@example.com", subject: "Hola", html: "<p>Hola</p>", text: "Hola" }, {});
    expect(result).toEqual({ delivered: "console" });
    expect(log.mock.calls[0]![0]).toContain("Asunto: Hola");
  });
});

describe("order formatting", () => {
  it("numbers, labels and the card", () => {
    expect(formatOrderNumber(1001)).toBe("LEGO-001001");
    expect(ORDER_STATUS_LABELS.PAID).toBe("Pagado");
    expect(paymentLabel("amex", "0005")).toBe("American Express •••• 0005");
    expect(paymentLabel(null, null)).toBe("Tarjeta");
  });

  it("timeline: reached steps, the current one, and a cancellation in place of the rest", () => {
    const paid = makeOrder({ status: "PAID", paidAt: "2026-10-17T15:05:00.000Z" });
    expect(orderTimeline(paid).map((step) => [step.key, step.state])).toEqual([
      ["placed", "done"],
      ["paid", "current"],
      ["shipped", "upcoming"],
      ["delivered", "upcoming"],
    ]);
    const delivered = makeOrder({ status: "DELIVERED", paidAt: "x", shippedAt: "y", deliveredAt: "z" });
    expect(orderTimeline(delivered).every((step) => step.state === "done")).toBe(true);
    const cancelled = makeOrder({ status: "CANCELLED", paidAt: "2026-10-17T15:05:00.000Z", cancelledAt: "2026-10-17T15:06:00.000Z" });
    expect(orderTimeline(cancelled).map((step) => [step.key, step.state])).toEqual([
      ["placed", "done"],
      ["paid", "done"],
      ["cancelled", "cancelled"],
    ]);
  });
});
