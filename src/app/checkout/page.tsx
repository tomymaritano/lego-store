"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { siteConfig } from "@/config/site";
import { useCartItems, useCartStore, useCartSubtotal, useCheckoutStore, useStoreHydrated } from "@/stores";
import { Breadcrumbs, Skeleton, showToast } from "@/components/ui";
import type { PaymentInfo, ShippingInfo } from "@/types";
import { CheckoutProgress } from "./_components/CheckoutProgress";
import { ConfirmationStep } from "./_components/ConfirmationStep";
import { OrderSummary } from "./_components/OrderSummary";
import { PaymentStep } from "./_components/PaymentStep";
import { ReviewStep } from "./_components/ReviewStep";
import { ShippingStep } from "./_components/ShippingStep";

export default function CheckoutPage() {
  const router = useRouter();
  const hydrated = useStoreHydrated(useCartStore);
  const cart = useCartItems();
  const subtotal = useCartSubtotal();

  const currentStep = useCheckoutStore((state) => state.currentStep);
  const shippingInfo = useCheckoutStore((state) => state.shippingInfo);
  const paymentSummary = useCheckoutStore((state) => state.paymentSummary);
  const orderId = useCheckoutStore((state) => state.orderId);
  const isProcessing = useCheckoutStore((state) => state.isProcessing);

  // Nothing to check out: back to the cart (unless the order just went through).
  useEffect(() => {
    if (hydrated && cart.length === 0 && currentStep !== "confirmation") router.replace("/cart");
  }, [hydrated, cart.length, currentStep, router]);

  // A step whose data is missing (the store is in memory only) restarts at shipping.
  const step =
    (currentStep === "payment" && !shippingInfo) || (currentStep === "review" && (!shippingInfo || !paymentSummary))
      ? "shipping"
      : currentStep;

  const { freeShippingThreshold, shippingCost } = siteConfig.commerce;
  const shipping = subtotal >= freeShippingThreshold ? 0 : shippingCost;
  const checkout = useCheckoutStore.getState;

  const handleShippingSubmit = (data: ShippingInfo) => {
    checkout().setShippingInfo(data);
    checkout().setStep("payment");
  };

  const handlePaymentSubmit = (data: PaymentInfo) => {
    // Only a summary (last 4 digits, name, expiry) is kept past this point.
    checkout().setPaymentInfo(data);
    checkout().setStep("review");
  };

  const handlePlaceOrder = async () => {
    try {
      await checkout().processOrder();
      useCartStore.getState().clearCart();
      showToast.success("¡Pedido realizado con éxito!");
    } catch {
      showToast.error("Error al procesar el pedido");
    }
  };

  if (!hydrated) {
    return (
      <div className="container-custom py-6" aria-busy="true">
        <h1 className="sr-only">Checkout</h1>
        <Skeleton className="mx-auto my-8 h-12 w-80" />
        <div className="grid gap-8 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="container-custom py-6">
        <Breadcrumbs items={[{ label: "Carrito", href: "/cart" }, { label: "Checkout" }]} />
        <h1 className="sr-only">Checkout</h1>

        {step !== "confirmation" && <CheckoutProgress current={step} />}

        <div className="grid gap-8 lg:grid-cols-3">
          <div className={step === "confirmation" ? "lg:col-span-3" : "lg:col-span-2"}>
            <AnimatePresence mode="wait">
              {step === "shipping" && (
                <ShippingStep key="shipping" initialData={shippingInfo} onSubmit={handleShippingSubmit} />
              )}
              {step === "payment" && (
                <PaymentStep
                  key="payment"
                  summary={paymentSummary}
                  onSubmit={handlePaymentSubmit}
                  onBack={() => checkout().setStep("shipping")}
                />
              )}
              {step === "review" && shippingInfo && paymentSummary && (
                <ReviewStep
                  key="review"
                  shippingInfo={shippingInfo}
                  payment={paymentSummary}
                  onBack={() => checkout().setStep("payment")}
                  onPlaceOrder={handlePlaceOrder}
                  isProcessing={isProcessing}
                />
              )}
              {step === "confirmation" && orderId && (
                <ConfirmationStep
                  key="confirmation"
                  orderId={orderId}
                  onContinueShopping={() => {
                    checkout().resetCheckout();
                    router.push("/");
                  }}
                />
              )}
            </AnimatePresence>
          </div>

          {step !== "confirmation" && (
            <div className="lg:col-span-1">
              <OrderSummary cart={cart} subtotal={subtotal} shipping={shipping} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
