"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { fadeIn } from "@/lib/motion";
import type { OrderView, UnavailableLine } from "@/lib/orders/types";
import type { CheckoutPaymentsConfig } from "@/lib/payments/config";
import { linesSubtotal, orderTotals } from "@/lib/pricing";
import { useShippingRules } from "@/providers/ShippingRulesProvider";
import { useViewer } from "@/providers/ViewerProvider";
import { useAppliedCoupon, useCartItems, useCartStore, useCheckedCoupon, useCheckoutStore, useCouponStore, useStoreHydrated } from "@/stores";
import { isMercadoPagoPayment, type MercadoPagoPaymentSummary, type PaymentSummary } from "@/stores/checkoutStore";
import { Breadcrumbs, Skeleton, showToast } from "@/components/ui";
import { orderTotalsView, totalsView } from "@/components/cart/OrderTotals";
import { couponRemovedNotice, useCouponRecheck } from "@/components/cart/useCouponRecheck";
import type { CartItem, CheckoutStep, ShippingInfo } from "@/types";
import { fetchCheckoutOrder, payMercadoPagoOrder, payOrder, prepareOrder, type ApiResult, type PrepareRequest } from "./checkoutApi";
import { ConfirmationStep } from "./ConfirmationStep";
import { MobileSummaryBar, orderLinesOf } from "./OrderLines";
import { OrderSummary } from "./OrderSummary";
import { ReviewStep } from "./ReviewStep";
import { ShippingStep, type CheckoutAccount } from "./ShippingStep";
import { StepDirectionContext } from "./StepPanel";
import { Stepper } from "./Stepper";
import { stepIndex } from "./steps";

/*
 * The payment step (Mercado Pago's Brick or Stripe's Elements, or the mock
 * options) is the second step: it
 * loads on demand, kept out of /checkout's first load, and is preloaded as
 * soon as the shipping step shows so the step change does not wait on it.
 */
const loadPaymentStep = () => import("./PaymentStep");
const PaymentStep = dynamic(() => loadPaymentStep().then((mod) => mod.PaymentStep), {
  ssr: false,
  loading: () => <Skeleton className="h-112" />,
});

const checkout = useCheckoutStore.getState;
const cartStore = useCartStore.getState;
const couponStore = useCouponStore.getState;

/**
 * The coupon code the order is prepared with: the applied coupon, once the
 * server confirmed it during this page load and the cart reaches its minimum
 * (below it the summary says what is missing and the order goes without
 * it). The server validates it again.
 */
function couponCodeFor(cart: CartItem[]): string | undefined {
  const { coupon, checked } = couponStore();
  return coupon && checked === coupon.code && linesSubtotal(cart) >= coupon.minSubtotal ? coupon.code : undefined;
}

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

/**
 * What changes the server's order: the lines, the address, the coupon and
 * (Stripe) the card. A Mercado Pago order knows nothing of the payment until it is paid.
 */
function prepareKeyOf(cart: CartItem[], shipping: ShippingInfo, payment: PaymentSummary, couponCode: string | undefined) {
  return JSON.stringify([
    cart.map((line) => [line.id, line.quantity]),
    shipping,
    isMercadoPagoPayment(payment) ? "MERCADOPAGO" : payment.confirmationTokenId,
    couponCode ?? null,
  ]);
}

/** Whether the confirmation keeps asking for the order's status: until it is settled (a cash ticket can take days: not that). */
const awaitingSettlement = (order: OrderView) =>
  order.status === "PENDING" || (order.status === "PAYMENT_PENDING" && order.payment.methodType !== "ticket");

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
 * there (POST /api/checkout/orders), "Realizar pedido" is the only step that
 * charges (…/pay: Stripe confirms its PaymentIntent, finishing 3D Secure with
 * Stripe.js when the bank asks; Mercado Pago creates the payment from what the
 * Brick collected, or sends the browser to pay with its account), and the
 * confirmation polls the order until the provider settles it.
 *
 * Placing the order swaps the whole checkout layout (header, stepper, step
 * and summary) for the confirmation as one unit, so nothing reflows while the
 * review fades out.
 */
export function CheckoutFlow({ payments, account = null }: { payments: CheckoutPaymentsConfig; account?: CheckoutAccount | null }) {
  const router = useRouter();
  const viewer = useViewer();
  const hydrated = useStoreHydrated(useCartStore);
  const couponHydrated = useStoreHydrated(useCouponStore);
  const cart = useCartItems();
  // The applied coupon is asked about again as the checkout loads; its discount counts once the server answers.
  useCouponRecheck();
  const storedCoupon = useAppliedCoupon();
  const coupon = useCheckedCoupon();
  const shippingRules = useShippingRules();
  const couponSettled = couponHydrated && (storedCoupon === null || coupon !== null);

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

  // The payment step's code, fetched while the visitor fills the shipping step.
  useEffect(() => {
    void loadPaymentStep();
  }, []);

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

  const cartTotals = orderTotals(cart, shippingRules, coupon);
  const couponCode = coupon && cartTotals.coupon?.applies ? coupon.code : undefined;
  // Waits for the persisted coupon and the server's answer about it: preparing without it would reserve
  // nothing and price the order without the discount (and then again with it).
  const prepareKey = step === "review" && shippingInfo && payment && couponSettled ? prepareKeyOf(cart, shippingInfo, payment, couponCode) : null;
  const ready = prepared && prepared.key === prepareKey ? prepared : null;
  const preparedOrder = ready && "order" in ready ? ready.order : null;

  // Entering "Revisar" (or changing the cart, address or card while there) prepares the order on the server.
  useEffect(() => {
    if (!prepareKey) return;
    const { shippingInfo: shipping, payment: card } = checkout();
    if (!shipping || !card) return;
    const controller = new AbortController();
    const lines = cartStore().cart.map((line) => ({ productId: line.id, quantity: line.quantity }));
    const requestedCoupon = couponCodeFor(cartStore().cart);
    const withCoupon = requestedCoupon ? { couponCode: requestedCoupon } : {};
    const request: PrepareRequest = isMercadoPagoPayment(card)
      ? { shipping, lines, ...withCoupon, provider: "MERCADOPAGO" }
      : { shipping, lines, ...withCoupon, confirmationTokenId: card.confirmationTokenId };
    void (async () => {
      let result: ApiResult<OrderView>;
      try {
        result = await prepareOrder(request, controller.signal);
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
        case "coupon":
          // The coupon cannot be used any more (expired, used up meanwhile...): the order is
          // prepared again without it, and the review says why.
          if (requestedCoupon) {
            // The review says it (not the coupon field too).
            pendingNotice.current = couponRemovedNotice(requestedCoupon, result.error);
            couponStore().remove();
            return;
          }
          setPrepared({ key: prepareKey, error: result.error, retry: true });
          return;
        default:
          setPrepared({ key: prepareKey, error: result.error, retry: result.code !== "payments_unconfigured" && result.code !== "invalid" });
      }
    })();
    return () => controller.abort();
  }, [prepareKey, prepareAttempt]);

  const placed = step === "confirmation" && placedOrder && placedOrder.id !== staleOrderId ? placedOrder : null;

  // A placed order (paid, waiting on a payment such as a cash ticket, or cancelled) gets its own address:
  // a reload, or coming back later, shows its status page (/checkout/pedido/<id>) instead of an empty
  // checkout. Still PENDING (Stripe's webhook on its way), it stays on /checkout until that settles.
  const placedHref = placed && placed.status !== "PENDING" ? `/checkout/pedido/${encodeURIComponent(placed.id)}` : null;
  useEffect(() => {
    if (placedHref && window.location.pathname !== placedHref) window.history.replaceState(null, "", placedHref);
  }, [placedHref]);

  // The confirmation follows the order until the provider settles it.
  const placedId = placed?.id;
  const placedPending = placed ? awaitingSettlement(placed) : false;
  useEffect(() => {
    if (!placedId || !placedPending) return;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      polls += 1;
      const result = await fetchCheckoutOrder(placedId, controller.signal).catch(() => null);
      if (controller.signal.aborted) return;
      if (result?.ok && result.data.status !== checkout().order?.status) checkout().orderPlaced(result.data);
      if (result?.ok && !awaitingSettlement(result.data)) return;
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
    // The coupon went with this order: the next purchase starts without it.
    if (order.couponCode && couponStore().coupon?.code === order.couponCode) couponStore().remove();
    replaceCart(
      lines.filter((line) => !bought.has(line.id)),
      owner
    );
  };

  /**
   * The coupon could not be held when paying (its place was taken while the
   * review was open, or this email already used it up): it comes off, the
   * order is prepared again without it (the review shows why), and the
   * customer places it again at the new total. Nothing was charged.
   */
  const couponRefusedAtPayment = (order: OrderView, message: string) => {
    const code = order.couponCode;
    if (!code || couponStore().coupon?.code !== code) {
      setPayError(message);
      return;
    }
    pendingNotice.current = couponRemovedNotice(code, message);
    couponStore().remove();
  };

  /** A refusal (or a step to redo) sends the customer back to the payment step with the reason. */
  const backToPayment = (message: string) => {
    setDirection(-1);
    setMoved(true);
    checkout().paymentFailed(message);
  };

  const placeMercadoPagoOrder = async (order: OrderView, payment: MercadoPagoPaymentSummary) => {
    const result = await payMercadoPagoOrder(order.id, { attemptId: payment.attemptId, method: payment.method, formData: payment.formData });
    if (!result.ok) {
      switch (result.code) {
        case "declined":
        case "payment_method":
          backToPayment(result.error);
          return;
        case "coupon":
          couponRefusedAtPayment(order, result.error);
          return;
        case "unavailable": {
          const before = cartStore().cart;
          pendingNotice.current = applyUnavailable(result.unavailable ?? []);
          if (cartStore().cart === before) setPayError(result.error);
          return;
        }
        case "not_pending": {
          const latest = await fetchCheckoutOrder(order.id);
          if (latest.ok && latest.data.status !== "PENDING") finishPurchase(latest.data);
          else setPayError(result.error);
          return;
        }
        default:
          setPayError(result.error);
          return;
      }
    }
    if (result.data.next === "redirect") {
      // "Cuenta de Mercado Pago": the customer pays on Mercado Pago's site and comes back to /checkout/pedido/<id>.
      window.location.assign(result.data.url);
      return;
    }
    finishPurchase(result.data.order);
  };

  const handlePlaceOrder = async () => {
    const card = checkout().payment;
    if (!preparedOrder || !card || checkout().isProcessing) return;
    setPayError(null);
    checkout().setProcessing(true);
    try {
      if (isMercadoPagoPayment(card)) {
        await placeMercadoPagoOrder(preparedOrder, card);
        return;
      }
      const result = await payOrder(preparedOrder.id, card.confirmationTokenId);
      if (!result.ok) {
        switch (result.code) {
          case "declined":
          case "payment_method":
            backToPayment(result.error);
            return;
          case "coupon":
            couponRefusedAtPayment(preparedOrder, result.error);
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
        const key = payments.provider === "STRIPE" ? payments.stripe.publishableKey : null;
        const stripe = key ? await import("./stripeClient").then((mod) => mod.getStripe(key)) : null;
        const outcome = stripe ? await stripe.handleNextAction({ clientSecret: result.data.clientSecret }) : null;
        if (!outcome || outcome.error) {
          backToPayment(outcome?.error?.message ?? "No pudimos verificar la tarjeta con tu banco. Inténtalo de nuevo.");
          return;
        }
      }
      finishPurchase(result.data.order);
    } finally {
      if (checkout().isProcessing) checkout().setProcessing(false);
    }
  };

  if (!hydrated || !couponHydrated || (cart.length === 0 && !placed)) {
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
  const summaryTotals = preparedOrder ? orderTotalsView(preparedOrder) : totalsView(cartTotals);
  const cartTotal = cartTotals.total;
  const couponField = {
    lines: cart.map((line) => ({ productId: line.id, quantity: line.quantity })),
    subtotal: cartTotals.subtotal,
  };
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

            <MobileSummaryBar lines={summaryLines} totals={summaryTotals} coupon={couponField} disabled={isProcessing} />

            <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-8">
              <div className="min-w-0 lg:col-span-2">
                <AnimatePresence mode="wait" custom={direction} initial={false}>
                  {step === "shipping" && (
                    <ShippingStep key="shipping" initialData={shippingInfo} account={account} focusHeading={moved} onSubmit={handleShippingSubmit} />
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

              <OrderSummary lines={summaryLines} totals={summaryTotals} coupon={couponField} isProcessing={isProcessing} />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </StepDirectionContext.Provider>
  );
}
