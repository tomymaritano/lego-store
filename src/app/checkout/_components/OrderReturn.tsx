"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { OrderView } from "@/lib/orders/types";
import { useCartStore, useCheckoutStore, useCouponStore, useStoreHydrated } from "@/stores";
import { Button } from "@/components/ui";
import { fetchCheckoutOrder, syncCheckoutOrder } from "./checkoutApi";
import { ConfirmationStep } from "./ConfirmationStep";

/** How often the page asks again while Mercado Pago has not reported the payment, and for how long. */
const POLL_MS = 3000;
const MAX_POLLS = 40;

const WAITING = "Si ya pagaste en Mercado Pago, la confirmación puede tardar unos minutos. Te avisaremos por email.";

/**
 * Back from Mercado Pago: asks the server to check the payment (it reads it
 * from Mercado Pago), then follows the order until it is settled, with the
 * checkout's confirmation. A placed order (paid, or a payment pending) leaves
 * the cart and ends this browser's checkout; one still unpaid offers to go
 * back and pay.
 */
export function OrderReturn({ initialOrder, paymentId, canViewInAccount }: { initialOrder: OrderView; paymentId: string | null; canViewInAccount: boolean }) {
  const [order, setOrder] = useState(initialOrder);
  const [stale, setStale] = useState(false);
  const cleared = useRef(false);
  // The stores read localStorage after this page's first effects: clearing before that would be overwritten.
  const cartReady = useStoreHydrated(useCartStore);
  const couponReady = useStoreHydrated(useCouponStore);
  const storesReady = cartReady && couponReady;

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let polls = 0;
    const poll = async () => {
      polls += 1;
      const result = await fetchCheckoutOrder(initialOrder.id, controller.signal).catch(() => null);
      if (controller.signal.aborted) return;
      if (result?.ok) setOrder(result.data);
      if (result?.ok && result.data.status !== "PENDING") return;
      if (polls >= MAX_POLLS) {
        setStale(true);
        return;
      }
      timer = setTimeout(poll, POLL_MS);
    };
    void (async () => {
      if (initialOrder.status === "PENDING" || initialOrder.status === "PAYMENT_PENDING") {
        const synced = await syncCheckoutOrder(initialOrder.id, paymentId).catch(() => null);
        if (controller.signal.aborted) return;
        if (synced?.ok) setOrder(synced.data);
        if (synced?.ok && synced.data.status !== "PENDING") return;
      }
      if (initialOrder.status === "PENDING") timer = setTimeout(poll, POLL_MS);
    })();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [initialOrder.id, initialOrder.status, paymentId]);

  // A placed order leaves this browser's cart (the server empties the account's when it is paid), and its
  // coupon went with it: the next purchase starts without it (as CheckoutFlow's finishPurchase).
  useEffect(() => {
    if (!storesReady || cleared.current || (order.status !== "PAID" && order.status !== "PAYMENT_PENDING")) return;
    cleared.current = true;
    const bought = new Set(order.items.map((item) => item.productId));
    const { cart, owner, replaceCart } = useCartStore.getState();
    replaceCart(
      cart.filter((line) => !bought.has(line.id)),
      owner
    );
    const coupons = useCouponStore.getState();
    if (order.couponCode && coupons.coupon?.code === order.couponCode) coupons.remove();
    useCheckoutStore.getState().resetCheckout();
  }, [order, storesReady]);

  return (
    <div className="space-y-6">
      <ConfirmationStep order={order} canViewInAccount={canViewInAccount} stale={stale} waitingMessage={WAITING} />
      {order.status === "PENDING" ? (
        <p className="text-center">
          <Button variant="ghost" render={<Link href="/checkout" />}>
            <ArrowLeft aria-hidden="true" />
            Volver al checkout para pagar
          </Button>
        </p>
      ) : null}
    </div>
  );
}
