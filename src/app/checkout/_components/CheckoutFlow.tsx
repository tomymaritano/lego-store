"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { fadeIn } from "@/lib/motion";
import { orderTotals } from "@/lib/pricing";
import { useCartItems, useCartStore, useCheckoutStore, useStoreHydrated } from "@/stores";
import { Breadcrumbs, Skeleton, showToast } from "@/components/ui";
import type { CartItem, CheckoutStep, PaymentInfo, ShippingInfo } from "@/types";
import { ConfirmationStep } from "./ConfirmationStep";
import { MobileSummaryBar } from "./OrderLines";
import { OrderSummary } from "./OrderSummary";
import { PaymentStep } from "./PaymentStep";
import { ReviewStep } from "./ReviewStep";
import { ShippingStep } from "./ShippingStep";
import { StepDirectionContext } from "./StepPanel";
import { Stepper } from "./Stepper";
import { stepIndex } from "./steps";

const checkout = useCheckoutStore.getState;

const isAbort = (error: unknown) => error instanceof Error && error.name === "AbortError";

/** The confirmation enters from the top of the page, not from wherever the review was scrolled. */
const scrollToTop = () => window.scrollTo({ top: 0, behavior: "instant" });

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
 * The checkout wizard (client island). Steps slide in the direction of
 * travel and focus moves to each new step's heading. The card number and CVV
 * stay inside PaymentStep's form; the store only keeps a summary.
 *
 * Placing the order swaps the whole checkout layout (header, stepper, step
 * and summary) for the confirmation as one unit, so nothing reflows while the
 * review fades out. Leaving the page while the payment runs cancels it.
 */
export function CheckoutFlow() {
  const router = useRouter();
  const hydrated = useStoreHydrated(useCartStore);
  const cart = useCartItems();

  const currentStep = useCheckoutStore((state) => state.currentStep);
  const shippingInfo = useCheckoutStore((state) => state.shippingInfo);
  const paymentSummary = useCheckoutStore((state) => state.paymentSummary);
  const orderId = useCheckoutStore((state) => state.orderId);
  const orderTotal = useCheckoutStore((state) => state.orderTotal);
  const isProcessing = useCheckoutStore((state) => state.isProcessing);

  const [direction, setDirection] = useState(1);
  // What was bought, for the confirmation (the cart is emptied once the order goes through).
  const [purchased, setPurchased] = useState<CartItem[]>([]);
  // Focus follows the step only after the visitor moved: not on page load.
  const [moved, setMoved] = useState(false);
  // The order being paid, so leaving the page can cancel it.
  const pendingOrder = useRef<AbortController | null>(null);
  // A confirmation already in the store when this page mounted belongs to an
  // earlier visit: it is cleared (below) and never shown again.
  const [staleOrderId] = useState(() => (checkout().currentStep === "confirmation" ? checkout().orderId : null));

  // Nothing to check out: back to the cart (unless the order just went through).
  useEffect(() => {
    if (hydrated && cart.length === 0 && currentStep !== "confirmation") router.replace("/cart");
  }, [hydrated, cart.length, currentStep, router]);

  // Leaving the confirmation ends this checkout: the next visit starts fresh.
  // Leaving while paying cancels the order, and the cart stays as it was.
  useEffect(() => {
    if (checkout().currentStep === "confirmation") checkout().resetCheckout();
    return () => {
      if (pendingOrder.current && checkout().isProcessing) {
        pendingOrder.current.abort();
        showToast.info("Cancelamos el pago porque saliste del checkout. Tu carrito sigue igual.");
      }
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

  // A step whose data is missing (the store is in memory only) restarts at shipping.
  const step: CheckoutStep =
    (currentStep === "payment" && !shippingInfo) || (currentStep === "review" && (!shippingInfo || !paymentSummary))
      ? "shipping"
      : currentStep;

  const goTo = (next: CheckoutStep) => {
    setDirection(stepIndex(next) >= stepIndex(step) ? 1 : -1);
    setMoved(true);
    checkout().setStep(next);
  };

  const handleShippingSubmit = (data: ShippingInfo) => {
    checkout().setShippingInfo(data);
    goTo("payment");
  };

  const handlePaymentSubmit = (data: PaymentInfo) => {
    // Only a summary (brand, last 4 digits, name, expiry) is kept past this point.
    checkout().setPaymentInfo(data);
    goTo("review");
  };

  const totals = orderTotals(cart);

  const handlePlaceOrder = async () => {
    if (checkout().isProcessing) return;
    const controller = new AbortController();
    pendingOrder.current = controller;
    try {
      setDirection(1);
      setPurchased(cart);
      await checkout().processOrder({ total: totals.total }, { signal: controller.signal });
      useCartStore.getState().clearCart();
    } catch (error) {
      // Cancelled because the visitor left: the unmount already told them.
      if (!isAbort(error)) showToast.error("No pudimos procesar el pago. Inténtalo de nuevo.");
    } finally {
      if (pendingOrder.current === controller) pendingOrder.current = null;
    }
  };

  const confirmed = step === "confirmation" && orderId !== null && orderId !== staleOrderId;

  if (!hydrated || (cart.length === 0 && !confirmed)) {
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

  return (
    <StepDirectionContext.Provider value={direction}>
      <AnimatePresence mode="wait" initial={false} onExitComplete={scrollToTop}>
        {confirmed ? (
          // Its "¡Gracias por tu compra!" is the page's h1.
          <ConfirmationStep
            key="confirmation"
            orderId={orderId}
            total={orderTotal}
            email={shippingInfo?.email ?? null}
            lines={purchased}
          />
        ) : (
          <m.div key="checkout" variants={fadeIn} initial="hidden" animate="visible" exit="exit">
            <CheckoutHeader />
            <div className="mb-8">
              <Stepper current={step} />
            </div>

            <MobileSummaryBar lines={cart} total={totals.total} />

            <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-8">
              <div className="min-w-0 lg:col-span-2">
                <AnimatePresence mode="wait" custom={direction} initial={false}>
                  {step === "shipping" && (
                    <ShippingStep key="shipping" initialData={shippingInfo} focusHeading={moved} onSubmit={handleShippingSubmit} />
                  )}
                  {step === "payment" && (
                    <PaymentStep
                      key="payment"
                      summary={paymentSummary}
                      focusHeading={moved}
                      onSubmit={handlePaymentSubmit}
                      onBack={() => goTo("shipping")}
                    />
                  )}
                  {step === "review" && shippingInfo && paymentSummary && (
                    <ReviewStep
                      key="review"
                      shippingInfo={shippingInfo}
                      payment={paymentSummary}
                      total={totals.total}
                      focusHeading={moved}
                      isProcessing={isProcessing}
                      onEditShipping={() => goTo("shipping")}
                      onEditPayment={() => goTo("payment")}
                      onPlaceOrder={handlePlaceOrder}
                    />
                  )}
                </AnimatePresence>
              </div>

              <OrderSummary lines={cart} isProcessing={isProcessing} />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </StepDirectionContext.Provider>
  );
}
