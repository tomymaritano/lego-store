"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { ArrowRight, ChevronLeft, CreditCard, FlaskConical, Lock, PlugZap } from "lucide-react";
import type { PaymentsClientConfig } from "@/lib/payments/config";
import { MOCK_CARDS, mockTokenId, type MockCardId } from "@/lib/payments/mock-cards";
import { paymentLabel } from "@/lib/orders/format";
import { FormAlert } from "@/components/auth/FormAlert";
import { Button, Field, RadioGroup, RadioGroupItem, Skeleton } from "@/components/ui";
import type { PaymentSummary } from "@/stores/checkoutStore";
import type { ShippingInfo } from "@/types";
import { StepCount, StepPanel } from "./StepPanel";
import { STRIPE_FONTS, getStripe, useStripeAppearance } from "./stripeClient";

interface PaymentStepProps {
  payments: PaymentsClientConfig;
  /** The billing details (the card holder is the person on the shipping form). */
  shipping: ShippingInfo;
  /** Amount of the order in pesos (the Payment Element shows payment methods for it). */
  amount: number;
  /** The card chosen before (going back from "Revisar"): it has to be entered again. */
  previous: PaymentSummary | null;
  /** Why the last payment failed. */
  error: string | null;
  focusHeading: boolean;
  onSubmit: (payment: PaymentSummary) => void;
  onBack: () => void;
}

/**
 * Step 2: the card. Stripe's Payment Element only collects it here
 * (elements.submit + stripe.createConfirmationToken): nothing is charged
 * until "Realizar pedido" on the review step, and the card never touches our
 * server. With STRIPE_MOCK=1 (tests, never production) a list of test cards
 * stands in for Stripe; without Stripe keys the step says payments are not
 * configured.
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
      <div className="space-y-5" data-payments-mode={payments.mode}>
        {error ? <FormAlert>{error}</FormAlert> : null}
        {previous && !error ? (
          <p className="text-label font-normal text-fg-secondary">
            Por seguridad, vuelve a ingresar la tarjeta ({paymentLabel(previous.brand, previous.last4)}).
          </p>
        ) : null}
        {payments.mode === "stripe" && payments.publishableKey ? (
          <StripePayment publishableKey={payments.publishableKey} shipping={shipping} amount={amount} onSubmit={onSubmit} onBack={onBack} />
        ) : payments.mode === "mock" ? (
          <MockPayment onSubmit={onSubmit} onBack={onBack} />
        ) : (
          <PaymentsNotConfigured missing={payments.missing} onBack={onBack} />
        )}
      </div>
    </StepPanel>
  );
}

function PaymentFooter({ onBack, disabled = false, busy = false }: { onBack: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
      <Button variant="ghost" type="button" onClick={onBack}>
        <ChevronLeft aria-hidden="true" />
        Volver a envío
      </Button>
      <Button type="submit" size="lg" disabled={disabled} loading={busy} focusableWhenDisabled className="w-full sm:w-auto">
        Revisar pedido
        {busy ? null : <ArrowRight aria-hidden="true" />}
      </Button>
    </div>
  );
}

function SecureNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-3 rounded-xl bg-bg-subtle p-4 text-label font-normal text-fg-secondary">
      <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
      <span>{children}</span>
    </p>
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
          <strong className="font-semibold text-fg">Modo de prueba.</strong> Los pagos son simulados (STRIPE_MOCK): no se
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

// ---------------------------------------------------------------------------
// Not configured
// ---------------------------------------------------------------------------

function PaymentsNotConfigured({ missing, onBack }: { missing: string[]; onBack: () => void }) {
  return (
    <form onSubmit={(event) => event.preventDefault()} aria-labelledby="payment-title" className="space-y-5">
      <div role="status" className="rounded-xl border border-border bg-bg-subtle p-5" data-testid="payments-not-configured">
        <p className="flex items-center gap-2 font-semibold text-fg">
          <PlugZap aria-hidden="true" className="size-5 text-fg-muted" />
          Pagos no configurados
        </p>
        {missing.length > 0 ? (
          <p className="mt-2 text-label font-normal text-fg-secondary">
            Este servidor no tiene Stripe configurado. Define <span className="font-mono text-fg">{missing.join(", ")}</span> en{" "}
            <span className="font-mono text-fg">.env.local</span> (ver README, «Checkout, pagos y pedidos») y reinicia el servidor.
          </p>
        ) : (
          <p className="mt-2 text-label font-normal text-fg-secondary">
            Los pagos no están disponibles en este momento. Inténtalo más tarde.
          </p>
        )}
      </div>
      <PaymentFooter onBack={onBack} disabled />
    </form>
  );
}
