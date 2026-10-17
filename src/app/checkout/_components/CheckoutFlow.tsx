"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { orderTotals } from "@/lib/pricing";
import { useCartItems, useCartStore, useCheckoutStore, useStoreHydrated } from "@/stores";
import { Skeleton, showToast } from "@/components/ui";
import type { CheckoutStep, PaymentInfo, ShippingInfo } from "@/types";
import { ConfirmationStep } from "./ConfirmationStep";
import { OrderSummary } from "./OrderSummary";
import { PaymentStep } from "./PaymentStep";
import { ReviewStep } from "./ReviewStep";
import { ShippingStep } from "./ShippingStep";
import { StepDirectionContext } from "./StepPanel";
import { Stepper } from "./Stepper";
import { stepIndex } from "./steps";

const checkout = useCheckoutStore.getState;

/**
 * The checkout wizard (client island). Steps slide in the direction of
 * travel and focus moves to each new step's heading. The card number and CVV
 * stay inside PaymentStep's form; the store only keeps a summary.
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
  // Focus follows the step only after the visitor moved: not on page load.
  const [moved, setMoved] = useState(false);

  // Nothing to check out: back to the cart (unless the order just went through).
  useEffect(() => {
    if (hydrated && cart.length === 0 && currentStep !== "confirmation") router.replace("/cart");
  }, [hydrated, cart.length, currentStep, router]);

  // Leaving the confirmation ends this checkout: the next visit starts fresh.
  useEffect(
    () => () => {
      if (checkout().currentStep === "confirmation") checkout().resetCheckout();
    },
    []
  );

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
    try {
      setDirection(1);
      await checkout().processOrder({ total: totals.total });
      useCartStore.getState().clearCart();
    } catch {
      showToast.error("No pudimos procesar el pago. Inténtalo de nuevo.");
    }
  };

  if (!hydrated || (cart.length === 0 && step !== "confirmation")) {
    return (
      <div aria-busy="true" className="space-y-8">
        <Skeleton className="mx-auto h-14 w-full max-w-xl" />
        <div className="grid gap-8 lg:grid-cols-3">
          <Skeleton className="h-112 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const confirmed = step === "confirmation" && orderId;

  return (
    <StepDirectionContext.Provider value={direction}>
      {!confirmed && (
        <div className="mb-8">
          <Stepper current={step} />
        </div>
      )}

      <div className={confirmed ? "" : "grid items-start gap-6 lg:grid-cols-3 lg:gap-8"}>
        <div className={confirmed ? "" : "min-w-0 lg:col-span-2"}>
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
            {confirmed && (
              <ConfirmationStep key="confirmation" orderId={orderId} total={orderTotal} email={shippingInfo?.email ?? null} />
            )}
          </AnimatePresence>
        </div>

        {!confirmed && <OrderSummary lines={cart} isProcessing={isProcessing} />}
      </div>
    </StepDirectionContext.Provider>
  );
}
