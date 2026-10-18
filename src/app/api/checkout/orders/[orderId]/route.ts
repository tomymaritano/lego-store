import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getCheckoutOrder } from "@/lib/orders/checkout";
import { CHECKOUT_MESSAGES, NO_STORE, checkoutError, requesterOf } from "@/lib/orders/http";
import type { CheckoutOrderResponse } from "@/lib/orders/types";
import { orderIdSchema } from "@/lib/validations/orders";

/**
 * GET /api/checkout/orders/<id>: the order as the checkout's confirmation
 * shows it (it polls this until the webhook marks it PAID or CANCELLED).
 * Only for its owner or the browser holding its checkout cookie; anyone else
 * gets the same 404 as for an order that does not exist.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const id = orderIdSchema.safeParse((await params).orderId);
  if (!id.success) return checkoutError("not_found", CHECKOUT_MESSAGES.not_found, 404);
  const order = await getCheckoutOrder(getDb(), id.data, await requesterOf(request));
  if (!order) return checkoutError("not_found", CHECKOUT_MESSAGES.not_found, 404);
  return NextResponse.json({ order } satisfies CheckoutOrderResponse, { headers: NO_STORE });
}
