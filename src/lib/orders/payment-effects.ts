import "server-only";

import { invalidateCatalog } from "@/lib/api/cache";
import type { Db } from "@/lib/lists/product";
import type { ApplyOutcome } from "./mercadopago";
import { sendOrderCancelled, sendOrderConfirmation, sendOrderPaymentLapsed, sendOrderPaymentPending } from "./notify";

/**
 * What follows a change Mercado Pago made to an order, once it has committed
 * (the checkout's own answer, a webhook, the return from Checkout Pro): the
 * catalogue shows the stock that moved, and the customer hears about it.
 * Never throws for an email (sendEmail logs its failures).
 */
export async function afterMercadoPagoPayment(db: Db, outcome: ApplyOutcome): Promise<void> {
  switch (outcome.result) {
    case "paid":
      invalidateCatalog({ productIds: outcome.productIds });
      await sendOrderConfirmation(db, outcome.orderId);
      return;
    case "pending":
      await sendOrderPaymentPending(db, outcome.orderId);
      return;
    case "cancelled":
      // Cancelled at the checkout itself (the customer is looking) needs no email; a payment that lapsed later does.
      if (outcome.lapsed) await sendOrderPaymentLapsed(db, outcome.orderId);
      return;
    case "out_of_stock":
    case "amount_mismatch":
      // Charged and refunded: a guest has no other way to know.
      await sendOrderCancelled(db, outcome.orderId);
      return;
    case "refunded":
      if (outcome.notify) await sendOrderCancelled(db, outcome.orderId);
      return;
    case "refund_cancelled":
      if (outcome.productIds.length > 0) invalidateCatalog({ productIds: outcome.productIds });
      await sendOrderCancelled(db, outcome.orderId);
      return;
    case "chargeback":
      if (outcome.productIds.length > 0) invalidateCatalog({ productIds: outcome.productIds });
      return;
    default:
      return;
  }
}
