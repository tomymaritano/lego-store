"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { fadeIn } from "@/lib/motion";
import type { OrderView, UnavailableLine } from "@/lib/orders/types";
import type { PaymentsClientConfig } from "@/lib/payments/config";
import { orderTotals } from "@/lib/pricing";
import { useViewer } from "@/providers/ViewerProvider";
import { useCartItems, useCartStore, useCheckoutStore, useStoreHydrated } from "@/stores";
import type { PaymentSummary } from "@/stores/checkoutStore";
import { Breadcrumbs, Skeleton, showToast } from "@/components/ui";
import type { CartItem, CheckoutStep, ShippingInfo } from "@/types";
import { fetchCheckoutOrder, payOrder, prepareOrder, type ApiResult } from "./checkoutApi";
import { ConfirmationStep } from "./ConfirmationStep";
import { MobileSummaryBar, orderLinesOf } from "./OrderLines";
import { OrderSummary } from "./OrderSummary";
import { PaymentStep } from "./PaymentStep";
import { ReviewStep } from "./ReviewStep";
import { ShippingStep } from "./ShippingStep";
import { StepDirectionContext } from "./StepPanel";
import { Stepper } from "./Stepper";
import { stepIndex } from "./steps";
import { getStripe } from "./stripeClient";

const checkout = useCheckoutStore.getState;
const cartStore = useCartStore.getState;

/** The confirmation enters from the top of the page, not from wherever the review was scrolled. */
const scrollToTop = () => window.scrollTo({ top: 0, behavior: "instant" });

/** How often the confirmation asks for the order's status while the webhook has not arrived. */
const POLL_MS = 1500;
const SLOW_POLL_MS = 5000;
/** After this many quick polls the confirmation says it is taking longer than usual. */
const QUICK_POLLS = 20;

/** Breadcrumbs and h1 while the purchase is in progress (not on the confirmation). */
function CheckoutHeader() {
  return (
    <>
      <Breadcrumbs items={[{ label: "Carrito", href: "/cart" }, { label: "Checkout" }]} />
      <h1 className="mt-4 mb-8 text-headline">Finalizar compra</h1>
    </>
  );
}

/** What changes the server's order: the lines, the address and the card. */
function prepareKeyOf(cart: CartItem[], shipping: ShippingInfo, payment: PaymentSummary) {
  return JSON.stringify([cart.map((line) => [line.id, line.quantity]), shipping, payment.confirmationTokenId]);
}

/**
 * Caps or drops the cart lines the server could not sell as asked, and says
 * what changed. The cart change makes the review prepare the order again.
 */
function applyUnavailable(unavailable: UnavailableLine[]): string {
  const cart = cartStore();
  const names: string[] = [];
  for (const line of unavailable) {
    const current = cart.cart.find((item) => item.id === line.productId);
    const name = line.name ?? current?.name ?? "Un producto";
    if (line.available <= 0) {
      cart.removeItem(line.productId);
      names.push(`${name} se agotó`);
    } else {
      cart.setQuantity(line.productId, line.available);
      names.push(line.available === 1 ? `de ${name} queda 1 unidad` : `de ${name} quedan ${line.available} unidades`);
    }
  }
  return `Actualizamos tu carrito: ${names.join("; ")}.`;
}

/** Adopts the prices the server charged for (a visitor's cart keeps snapshots). True when any changed. */
function adoptServerPrices(order: OrderView): boolean {
  const { cart, owner, replaceCart } = cartStore();
  const prices = new Map(order.items.map((item) => [item.productId, item.unitPrice]));
  let changed = false;
  const next = cart.map((line) => {
    const price = prices.get(line.id);
    if (price === undefined || price === line.price) return line;
    changed = true;
    return { ...line, price };
  });
  if (changed) replaceCart(next, owner);
  return changed;
}

type Prepared = { key: string; order: OrderView } | { key: string; error: string; retry: boolean };

/**
 * The checkout wizard (client island): Envío → Pago → Revisar, then the
 * confirmation. Steps slide in the direction of travel and focus moves to
 * each new step's heading.
 *
 * Money and stock are the server's: entering "Revisar" prepares the order
 * there (POST /api/checkout/orders), "Realizar pedido" confirms its payment
 * (…/pay, finishing 3D Secure with Stripe.js when the bank asks), and the
 * confirmation polls the order until Stripe's webhook marks it paid.
 *
 * Placing the order swaps the whole checkout layout (header, stepper, step
 * and summary) for the confirmation as one unit, so nothing reflows while the
 * review fades out.
 */
export function CheckoutFlow({ payments }: { payments: PaymentsClientConfig }) {
  const router = useRouter();
  const viewer = useViewer();
  const hydrated = useStoreHydrated(useCartStore);
  const cart = useCartItems();

  const currentStep = useCheckoutStore((state) => state.currentStep);
  const shippingInfo = useCheckoutStore((state) => state.shippingInfo);
  const payment = useCheckoutStore((state) => state.payment);
  const paymentError = useCheckoutStore((state) => state.paymentError);
  const placedOrder = useCheckoutStore((state) => state.order);
  const isProcessing = useCheckoutStore((state) => state.isProcessing);

  const [direction, setDirection] = useState(1);
  // Focus follows the step only after the visitor moved: not on page load.
  const [moved, setMoved] = useState(false);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [prepareAttempt, setPrepareAttempt] = useState(0);
  // What changed in the cart since the last order was prepared (shown once it is ready).
  const [notice, setNotice] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [statusStale, setStatusStale] = useState(false);
  const pendingNotice = useRef<string | null>(null);
  // A confirmation already in the store when this page mounted belongs to an
  // earlier visit: it is cleared (below) and never shown again.
  const [staleOrderId] = useState(() => (checkout().currentStep === "confirmation" ? (checkout().order?.id ?? null) : null));

  // Nothing to check out: back to the cart (unless the order just went through).
  useEffect(() => {
    if (hydrated && cart.length === 0 && currentStep !== "confirmation") router.replace("/cart");
  }, [hydrated, cart.length, currentStep, router]);

  // Leaving the confirmation ends this checkout: the next visit starts fresh.
  useEffect(() => {
    if (checkout().currentStep === "confirmation") checkout().resetCheckout();
    return () => {
      if (checkout().currentStep === "confirmation") checkout().resetCheckout();
    };
  }, []);

  // Closing or reloading the tab mid-payment asks first.
  useEffect(() => {
    if (!isProcessing) return;
    const confirmLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", confirmLeave);
    return () => window.removeEventListener("beforeunload", confirmLeave);
  }, [isProcessing]);

  // A step whose data is missing (the store is in memory only) goes back to the one that provides it.
  const step: CheckoutStep =
    !shippingInfo && (currentStep === "payment" || currentStep === "review")
      ? "shipping"
      : currentStep === "review" && !payment
        ? "payment"
        : currentStep;

  const prepareKey = step === "review" && shippingInfo && payment ? prepareKeyOf(cart, shippingInfo, payment) : null;
  const ready = prepared && prepared.key === prepareKey ? prepared : null;
  const preparedOrder = ready && "order" in ready ? ready.order : null;

  // Entering "Revisar" (or changing the cart, address or card while there) prepares the order on the server.
  useEffect(() => {
    if (!prepareKey) return;
    const { shippingInfo: shipping, payment: card } = checkout();
    if (!shipping || !card) return;
    const controller = new AbortController();
    const lines = cartStore().cart.map((line) => ({ productId: line.id, quantity: line.quantity }));
    void (async () => {
      let result: ApiResult<OrderView>;
      try {
        result = await prepareOrder({ shipping, lines, confirmationTokenId: card.confirmationTokenId }, controller.signal);
      } catch {
        return; // Aborted: the inputs changed and a newer request is on its way.
      }
      if (controller.signal.aborted) return;
      if (result.ok) {
        const repriced = adoptServerPrices(result.data);
        // Repricing changes the cart only in price, not in the key: this order stays current.
        setNotice(
          pendingNotice.current ?? (repriced ? "Actualizamos los precios de algunos productos: revisa el total antes de pagar." : null)
        );
        pendingNotice.current = null;
        setPrepared({ key: prepareKey, order: result.data });
        return;
      }
      switch (result.code) {
        case "unavailable": {
          const before = cartStore().cart;
          pendingNotice.current = applyUnavailable(result.unavailable ?? []);
          if (cartStore().cart.length === 0) showToast.error(pendingNotice.current);
          // The cart change prepares the order again; if nothing changed, say so instead of waiting.
          else if (cartStore().cart === before) setPrepared({ key: prepareKey, error: result.error, retry: true });
          return;
        }
        case "payment_method":
          setDirection(-1);
          setMoved(true);
          checkout().paymentFailed(result.error);
          return;
        default:
          setPrepared({ key: prepareKey, error: result.error, retry: result.code !== "payments_unconfigured" && result.code !== "invalid" });
      }
    })();
    return () => controller.abort();
  }, [prepareKey, prepareAttempt]);

  const placed = step === "confirmation" && placedOrder && placedOrder.id !== staleOrderId ? placedOrder : null;

  // The confirmation follows the order until Stripe's webhook settles it.
  const placedId = placed?.id;
  const placedPending = placed?.status === "PENDING";
  useEffect(() => {
    if (!placedId || !placedPending) return;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      polls += 1;
      const result = await fetchCheckoutOrder(placedId, controller.signal).catch(() => null);
      if (controller.signal.aborted) return;
      if (result?.ok && result.data.status !== "PENDING") {
        checkout().orderPlaced(result.data);
        return;
      }
      if (polls === QUICK_POLLS) setStatusStale(true);
      timer = setTimeout(poll, polls < QUICK_POLLS ? POLL_MS : SLOW_POLL_MS);
    };
    timer = setTimeout(poll, POLL_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [placedId, placedPending]);

  const goTo = (next: CheckoutStep) => {
    setDirection(stepIndex(next) >= stepIndex(step) ? 1 : -1);
    setMoved(true);
    setPayError(null);
    checkout().setStep(next);
  };

  const handleShippingSubmit = (data: ShippingInfo) => {
    checkout().setShippingInfo(data);
    goTo("payment");
  };

  const handlePaymentSubmit = (summary: PaymentSummary) => {
    checkout().setPayment(summary);
    goTo("review");
  };

  /** The payment went through: the bought lines leave the cart (the webhook empties the account's cart too). */
  const finishPurchase = (order: OrderView) => {
    const bought = new Set(order.items.map((item) => item.productId));
    const { cart: lines, owner, replaceCart } = cartStore();
    setDirection(1);
    checkout().orderPlaced(order);
    replaceCart(
      lines.filter((line) => !bought.has(line.id)),
      owner
    );
  };

  const handlePlaceOrder = async () => {
    const card = checkout().payment;
    if (!preparedOrder || !card || checkout().isProcessing) return;
    setPayError(null);
    checkout().setProcessing(true);
    try {
      const result = await payOrder(preparedOrder.id, card.confirmationTokenId);
      if (!result.ok) {
        switch (result.code) {
          case "declined":
          case "payment_method":
            setDirection(-1);
            setMoved(true);
            checkout().paymentFailed(result.error);
            return;
          case "unavailable": {
            const before = cartStore().cart;
            pendingNotice.current = applyUnavailable(result.unavailable ?? []);
            if (cartStore().cart === before) setPayError(result.error);
            return;
          }
          case "not_pending": {
            // Paid or cancelled meanwhile (another tab): show where it stands.
            const latest = await fetchCheckoutOrder(preparedOrder.id);
            if (latest.ok && latest.data.status !== "PENDING") finishPurchase(latest.data);
            else setPayError(result.error);
            return;
          }
          default:
            setPayError(result.error);
            return;
        }
      }
      if (result.data.next === "action") {
        const stripe = payments.publishableKey ? await getStripe(payments.publishableKey) : null;
        const outcome = stripe ? await stripe.handleNextAction({ clientSecret: result.data.clientSecret }) : null;
        if (!outcome || outcome.error) {
          setDirection(-1);
          setMoved(true);
          checkout().paymentFailed(outcome?.error?.message ?? "No pudimos verificar la tarjeta con tu banco. Inténtalo de nuevo.");
          return;
        }
      }
      finishPurchase(result.data.order);
    } finally {
      if (checkout().isProcessing) checkout().setProcessing(false);
    }
  };

  if (!hydrated || (cart.length === 0 && !placed)) {
    return (
      <>
        <CheckoutHeader />
        <div aria-busy="true" className="space-y-8">
          <Skeleton className="mx-auto h-14 w-full max-w-xl" />
          <div className="grid gap-8 lg:grid-cols-3">
            <Skeleton className="h-112 lg:col-span-2" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </>
    );
  }

  // The review shows (and charges) the server's lines; the other steps show the cart.
  const summaryLines = preparedOrder ? orderLinesOf(preparedOrder) : cart;
  const cartTotal = orderTotals(cart).total;
  const reviewError = payError ?? (ready && "error" in ready ? ready.error : null);

  return (
    <StepDirectionContext.Provider value={direction}>
      <AnimatePresence mode="wait" initial={false} onExitComplete={scrollToTop}>
        {placed ? (
          // Its heading is the page's h1.
          <ConfirmationStep
            key="confirmation"
            order={placed}
            canViewInAccount={Boolean(viewer && placed.hasAccount)}
            stale={statusStale}
          />
        ) : (
          <m.div key="checkout" variants={fadeIn} initial="hidden" animate="visible" exit="exit">
            <CheckoutHeader />
            <div className="mb-8">
              <Stepper current={step} />
            </div>

            <MobileSummaryBar lines={summaryLines} total={preparedOrder?.total ?? cartTotal} />

            <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-8">
              <div className="min-w-0 lg:col-span-2">
                <AnimatePresence mode="wait" custom={direction} initial={false}>
                  {step === "shipping" && (
                    <ShippingStep key="shipping" initialData={shippingInfo} focusHeading={moved} onSubmit={handleShippingSubmit} />
                  )}
                  {step === "payment" && shippingInfo && (
                    <PaymentStep
                      key="payment"
                      payments={payments}
                      shipping={shippingInfo}
                      amount={cartTotal}
                      previous={payment}
                      error={paymentError}
                      focusHeading={moved}
                      onSubmit={handlePaymentSubmit}
                      onBack={() => goTo("shipping")}
                    />
                  )}
                  {step === "review" && shippingInfo && payment && (
                    <ReviewStep
                      key="review"
                      shippingInfo={shippingInfo}
                      payment={payment}
                      total={preparedOrder?.total ?? null}
                      error={reviewError}
                      notice={preparedOrder ? notice : null}
                      focusHeading={moved}
                      isProcessing={isProcessing}
                      onEditShipping={() => goTo("shipping")}
                      onEditPayment={() => goTo("payment")}
                      onPlaceOrder={handlePlaceOrder}
                      onRetry={
                        payError || (ready && "error" in ready && ready.retry)
                          ? () => {
                              setPayError(null);
                              if (!preparedOrder) {
                                setPrepared(null);
                                setPrepareAttempt((attempt) => attempt + 1);
                              }
                            }
                          : undefined
                      }
                    />
                  )}
                </AnimatePresence>
              </div>

              <OrderSummary lines={summaryLines} isProcessing={isProcessing} />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </StepDirectionContext.Provider>
  );
}
