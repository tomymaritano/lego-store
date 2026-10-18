"use client";

import { useEffect, useMemo, useState } from "react";
import { Payment, initMercadoPago } from "@mercadopago/sdk-react";
import type { ShippingInfo } from "@/types";

/*
 * Mercado Pago's Payment Brick (@mercadopago/sdk-react), loaded only for real
 * credentials (never in the mock or the tests). Cards with installments and
 * cash; Spanish (es-AR); themed with the store's tokens, light or dark, read
 * from <html> (its iframe cannot read our CSS variables). Its pay button is
 * hidden: the payment step's "Revisar pedido" reads the form through
 * window.paymentBrickController.getFormData() and nothing is charged until
 * "Realizar pedido" (./MercadoPagoPayment.tsx).
 */

/** What the Brick puts on window (https://github.com/mercadopago/sdk-js/blob/main/docs/bricks/payment-guest.md). */
export interface PaymentBrickController {
  getFormData(): Promise<{ paymentType?: string; selectedPaymentMethod?: string; formData?: unknown; additionalData?: unknown } | null | undefined>;
  getAdditionalData?(): Promise<unknown>;
  unmount(): void;
}

declare global {
  interface Window {
    paymentBrickController?: PaymentBrickController;
  }
}

const token = (styles: CSSStyleDeclaration, name: string) => styles.getPropertyValue(name).trim();

/** The Brick's look from the store's tokens at this moment. */
function readBrickStyle() {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const dark = root.classList.contains("dark");
  return {
    theme: (dark ? "dark" : "default") as "dark" | "default",
    customVariables: {
      textPrimaryColor: token(styles, "--fg"),
      textSecondaryColor: token(styles, "--fg-secondary"),
      inputBackgroundColor: token(styles, "--surface"),
      formBackgroundColor: token(styles, "--surface"),
      baseColor: token(styles, "--focus-ring"),
      outlinePrimaryColor: token(styles, "--border-strong"),
      outlineSecondaryColor: token(styles, "--border"),
      errorColor: token(styles, "--danger"),
      successColor: token(styles, "--success"),
      borderRadiusMedium: token(styles, "--radius-lg") || "0.5rem",
      borderRadiusLarge: token(styles, "--radius-xl") || "0.75rem",
      formPadding: "0px",
    },
  };
}

/** The Brick's style, refreshed when the theme changes (the `dark` class on <html>): the Brick re-renders with it. */
function useBrickStyle() {
  const [style, setStyle] = useState<ReturnType<typeof readBrickStyle> | null>(null);
  useEffect(() => {
    const update = () => setStyle(readBrickStyle());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return style;
}

const noSubmit = async () => {
  // The Brick's own button is hidden; "Revisar pedido" reads the form instead.
};

export function PaymentBrick({
  publicKey,
  shipping,
  amount,
  onReady,
  onLoadError,
}: {
  publicKey: string;
  shipping: ShippingInfo;
  amount: number;
  onReady: () => void;
  onLoadError: () => void;
}) {
  // The SDK takes the public key once per Brick (initMercadoPago keeps one instance; calling it again is harmless).
  const [initialisedKey] = useState(() => {
    initMercadoPago(publicKey, { locale: "es-AR" });
    return publicKey;
  });
  const style = useBrickStyle();

  // The Brick re-mounts whenever these objects change: memoised on what they hold.
  const initialization = useMemo(
    () => ({ amount, payer: { email: shipping.email, firstName: shipping.firstName, lastName: shipping.lastName } }),
    [amount, shipping.email, shipping.firstName, shipping.lastName]
  );
  const customization = useMemo(
    () =>
      style && {
        paymentMethods: { creditCard: "all" as const, debitCard: "all" as const, prepaidCard: "all" as const, ticket: "all" as const, maxInstallments: 12 },
        visual: { hidePaymentButton: true, style },
      },
    [style]
  );

  if (!customization || initialisedKey !== publicKey) return null;
  return (
    <Payment
      id="paymentBrick_container"
      locale="es-AR"
      initialization={initialization}
      customization={customization}
      onSubmit={noSubmit}
      onReady={onReady}
      onError={(error) => {
        console.error("[mercadopago] Error del Payment Brick:", error);
        if (error.type === "critical") onLoadError();
      }}
    />
  );
}
