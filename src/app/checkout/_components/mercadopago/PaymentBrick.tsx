"use client";

import { useMemo, useState } from "react";
import { Payment, initMercadoPago } from "@mercadopago/sdk-react";
import type { ShippingInfo } from "@/types";
import { useThemed, type ThemeTokens } from "../providerTheme";

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

/** The Brick's look from the store's tokens (../providerTheme.ts). */
function brickStyle({ dark, token }: ThemeTokens) {
  return {
    theme: (dark ? "dark" : "default") as "dark" | "default",
    customVariables: {
      textPrimaryColor: token("--fg"),
      textSecondaryColor: token("--fg-secondary"),
      inputBackgroundColor: token("--surface"),
      formBackgroundColor: token("--surface"),
      baseColor: token("--focus-ring"),
      outlinePrimaryColor: token("--border-strong"),
      outlineSecondaryColor: token("--border"),
      errorColor: token("--danger"),
      successColor: token("--success"),
      borderRadiusMedium: token("--radius-lg") || "0.5rem",
      borderRadiusLarge: token("--radius-xl") || "0.75rem",
      formPadding: "0px",
    },
  };
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
  // Refreshed when the theme changes: the Brick re-renders with it.
  const style = useThemed(brickStyle);

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
