import "server-only";

import { orderCancelledEmail, orderConfirmationEmail, orderShippedEmail } from "@/lib/email/orders";
import { sendEmail, type EmailResult } from "@/lib/email/send";
import type { Db } from "@/lib/lists/product";
import { getOrderView } from "./queries";

/*
 * Customer emails about an order, sent after the change that triggers them
 * has committed. They never throw (sendEmail logs failures).
 */

/** "Confirmamos tu pedido": when the order becomes PAID (webhook). */
export async function sendOrderConfirmation(db: Db, orderId: string): Promise<EmailResult | null> {
  const order = await getOrderView(db, orderId);
  return order ? sendEmail(orderConfirmationEmail(order)) : null;
}

/** "Tu pedido está en camino": when the admin marks the order SHIPPED. */
export async function sendOrderShipped(db: Db, orderId: string): Promise<EmailResult | null> {
  const order = await getOrderView(db, orderId);
  return order ? sendEmail(orderShippedEmail(order)) : null;
}

/** "Cancelamos tu pedido": when a paid order is cancelled and refunded (admin, a refund in Stripe, out of stock at payment, amount mismatch). */
export async function sendOrderCancelled(db: Db, orderId: string): Promise<EmailResult | null> {
  const order = await getOrderView(db, orderId);
  return order?.status === "CANCELLED" ? sendEmail(orderCancelledEmail(order)) : null;
}
