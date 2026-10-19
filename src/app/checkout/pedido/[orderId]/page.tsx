import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { CHECKOUT_COOKIE, parseCheckoutCookie } from "@/lib/orders/access";
import { getCheckoutOrder } from "@/lib/orders/checkout";
import { orderIdSchema } from "@/lib/validations/orders";
import { OrderReturn } from "../../_components/OrderReturn";

export const metadata: Metadata = {
  title: "Estado del pedido",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ orderId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

/**
 * /checkout/pedido/<id>: where Mercado Pago brings the customer back after
 * paying with their account (Checkout Pro's back_urls; it adds payment_id and
 * status to the URL). Only for the order's owner or the browser that placed
 * it (its checkout cookie); anyone else gets a 404. The page asks the server
 * to check the payment with Mercado Pago (the URL is never trusted) and then
 * follows the order like the checkout's confirmation does.
 */
export default async function OrderReturnPage({ params, searchParams }: Props) {
  await connection();
  const id = orderIdSchema.safeParse((await params).orderId);
  if (!id.success) notFound();
  const user = await getCurrentUser();
  const access = parseCheckoutCookie((await cookies()).get(CHECKOUT_COOKIE)?.value);
  const order = await getCheckoutOrder(getDb(), id.data, { userId: user?.id ?? null, access });
  if (!order) notFound();

  const query = await searchParams;
  // Mercado Pago names it payment_id (and collection_id, its older name).
  const paymentId = first(query.payment_id) ?? first(query.collection_id);
  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="container-custom py-6 md:py-10">
        <OrderReturn
          initialOrder={order}
          paymentId={paymentId && /^\d{1,20}$/.test(paymentId) ? paymentId : null}
          canViewInAccount={Boolean(user && order.hasAccount)}
        />
      </div>
    </div>
  );
}
