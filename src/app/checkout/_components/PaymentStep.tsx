"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { CreditCard, FlaskConical } from "lucide-react";
import type { CheckoutPaymentsConfig } from "@/lib/payments/config";
import { MOCK_CARDS, mockTokenId, type MockCardId } from "@/lib/payments/mock-cards";
import { paymentLabel } from "@/lib/orders/format";
import { FormAlert } from "@/components/auth/FormAlert";
import { Field, RadioGroup, RadioGroupItem, Skeleton } from "@/components/ui";
import { isMercadoPagoPayment, type PaymentSummary } from "@/stores/checkoutStore";
import type { ShippingInfo } from "@/types";
import { MercadoPagoPayment } from "./mercadopago/MercadoPagoPayment";
import { PaymentFooter, PaymentsNotConfigured, SecureNote } from "./PaymentParts";
import { StepCount, StepPanel } from "./StepPanel";
import { STRIPE_FONTS, getStripe, useStripeAppearance } from "./stripeClient";

interface PaymentStepProps {
  payments: CheckoutPaymentsConfig;
  /** The billing details (the card holder is the person on the shipping form). */
  shipping: ShippingInfo;
  /** Amount of the order in pesos (the Payment Element shows payment methods for it). */
  amount: number;
  /** The payment chosen before (going back from "Revisar"): a card has to be entered again. */
  previous: PaymentSummary | null;
  /** Why the last payment failed. */
  error: string | null;
  focusHeading: boolean;
  onSubmit: (payment: PaymentSummary) => void;
  onBack: () => void;
}

/**
 * Step 2: how to pay, with the store's provider (PAYMENT_PROVIDER). This step
 * only collects: nothing is charged until "Realizar pedido" on the review
 * step, and card data never touches our server.
 * - Mercado Pago (./mercadopago): its Payment Brick (cards with installments,
 *   cash) or "Cuenta de Mercado Pago".
 * - Stripe: its Payment Element (elements.submit +
 *   stripe.createConfirmationToken).
 * With PAYMENTS_MOCK=1 (tests, never production) a list of test options
 * stands in for each provider; without credentials the step says payments are
 * not configured.
 */
export function PaymentStep({ payments, shipping, amount, previous, error, focusHeading, onSubmit, onBack }: PaymentStepProps) {
  return (
    <StepPanel
      titleId="payment-title"
      title="Pago"
      icon={<CreditCard />}
      focusHeading={focusHeading}
      aside={<StepCount index={1} total={3} />}
    >
      <div className="space-y-5" data-payments-mode={payments.mode} data-payments-provider={payments.provider}>
        {error ? <FormAlert>{error}</FormAlert> : null}
        {previous && !error && (!isMercadoPagoPayment(previous) || previous.method === "card") && previous.last4 ? (
          <p className="text-label font-normal text-fg-secondary">
            Por seguridad, vuelve a ingresar la tarjeta ({paymentLabel(previous.brand, previous.last4)}).
          </p>
        ) : null}
        {payments.provider === "MERCADOPAGO" ? (
          <MercadoPagoPayment config={payments.mercadopago} shipping={shipping} amount={amount} onSubmit={onSubmit} onBack={onBack} />
        ) : payments.stripe.mode === "stripe" && payments.stripe.publishableKey ? (
          <StripePayment publishableKey={payments.stripe.publishableKey} shipping={shipping} amount={amount} onSubmit={onSubmit} onBack={onBack} />
        ) : payments.stripe.mode === "mock" ? (
          <MockPayment onSubmit={onSubmit} onBack={onBack} />
        ) : (
          <PaymentsNotConfigured provider="Stripe" missing={payments.stripe.missing} onBack={onBack} />
        )}
      </div>
    </StepPanel>
  );
}

// ---------------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------------

function StripePayment({
  publishableKey,
  shipping,
  amount,
  onSubmit,
  onBack,
}: {
  publishableKey: string;
  shipping: ShippingInfo;
  amount: number;
  onSubmit: (payment: PaymentSummary) => void;
  onBack: () => void;
}) {
  const appearance = useStripeAppearance();
  if (!appearance) return <Skeleton className="h-56" />;
  return (
    <Elements
      stripe={getStripe(publishableKey)}
      options={{
        mode: "payment",
        amount: Math.round(amount * 100),
        currency: "ars",
        allowedPaymentMethodTypes: ["card"],
        appearance,
        fonts: STRIPE_FONTS,
        locale: "es-419",
      }}
    >
      <StripePaymentForm shipping={shipping} onSubmit={onSubmit} onBack={onBack} />
    </Elements>
  );
}

function StripePaymentForm({
  shipping,
  onSubmit,
  onBack,
}: {
  shipping: ShippingInfo;
  onSubmit: (payment: PaymentSummary) => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Validates the fields (Stripe shows its own messages next to them).
      const { error: invalid } = await elements.submit();
      if (invalid) return;
      const { error: failed, confirmationToken } = await stripe.createConfirmationToken({
        elements,
        params: {
          payment_method_data: {
            billing_details: {
              name: `${shipping.firstName} ${shipping.lastName}`,
              email: shipping.email,
              phone: shipping.phone,
              address: {
                line1: shipping.address,
                line2: null,
                city: shipping.city,
                state: shipping.state,
                postal_code: shipping.zipCode,
                country: "AR",
              },
            },
          },
        },
      });
      if (failed || !confirmationToken) {
        setError(failed?.message ?? "No pudimos validar la tarjeta. Inténtalo de nuevo.");
        return;
      }
      const card = confirmationToken.payment_method_preview.card;
      onSubmit({ confirmationTokenId: confirmationToken.id, brand: card?.brand ?? "card", last4: card?.last4 ?? "" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate aria-labelledby="payment-title" className="space-y-5">
      {error ? <FormAlert>{error}</FormAlert> : null}
      {loadFailed ? (
        <FormAlert>No pudimos cargar el formulario de pago. Revisa tu conexión y recarga la página.</FormAlert>
      ) : (
        <div className="relative min-h-56">
          {!ready ? <Skeleton aria-hidden="true" className="absolute inset-0" /> : null}
          <PaymentElement
            options={{
              layout: "tabs",
              fields: { billingDetails: { name: "never", email: "never", phone: "never", address: "never" } },
              wallets: { applePay: "never", googlePay: "never", link: "never" },
            }}
            onReady={() => setReady(true)}
            onLoadError={() => setLoadFailed(true)}
          />
        </div>
      )}
      <SecureNote>
        Los datos de la tarjeta los procesa Stripe y nunca pasan por nuestros servidores. No se cobra nada hasta que
        confirmes el pedido en el paso siguiente.
      </SecureNote>
      <PaymentFooter onBack={onBack} disabled={!ready || !stripe} busy={busy} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Mock (STRIPE_MOCK=1: tests only)
// ---------------------------------------------------------------------------

const MOCK_CARD_IDS = Object.keys(MOCK_CARDS) as MockCardId[];

function MockPayment({ onSubmit, onBack }: { onSubmit: (payment: PaymentSummary) => void; onBack: () => void }) {
  const [card, setCard] = useState<MockCardId>("visa");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const { brand, last4 } = MOCK_CARDS[card];
        onSubmit({ confirmationTokenId: mockTokenId(card), brand, last4 });
      }}
      aria-labelledby="payment-title"
      className="space-y-5"
    >
      <p className="flex items-start gap-3 rounded-xl border border-warning bg-bg-subtle p-4 text-label font-normal text-fg-secondary">
        <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg" />
        <span>
          <strong className="font-semibold text-fg">Modo de prueba.</strong> Los pagos son simulados (PAYMENTS_MOCK): no se
          contacta a Stripe ni se cobra nada.
        </span>
      </p>
      <Field label="Tarjeta de prueba">
        <RadioGroup value={card} onValueChange={(value) => setCard(value as MockCardId)}>
          {MOCK_CARD_IDS.map((id) => (
            <RadioGroupItem
              key={id}
              value={id}
              label={MOCK_CARDS[id].label}
              description={<span className="font-mono">{MOCK_CARDS[id].number}</span>}
            />
          ))}
        </RadioGroup>
      </Field>
      <PaymentFooter onBack={onBack} />
    </form>
  );
}
