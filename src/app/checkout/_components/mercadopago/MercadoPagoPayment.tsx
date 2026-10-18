"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { FlaskConical, Wallet } from "lucide-react";
import type { MercadoPagoClientConfig } from "@/lib/payments/config";
import { MP_MOCK_CARDS, MP_MOCK_TICKETS, mpMockToken, type MpMockCardId, type MpMockTicketId } from "@/lib/payments/mercadopago/mock-options";
import { FormAlert } from "@/components/auth/FormAlert";
import { Field, RadioGroup, RadioGroupItem, Skeleton } from "@/components/ui";
import type { MercadoPagoPaymentSummary, PaymentSummary } from "@/stores/checkoutStore";
import type { ShippingInfo } from "@/types";
import { PaymentFooter, PaymentsNotConfigured, SecureNote } from "../PaymentParts";

/*
 * The payment step with Mercado Pago. Two ways to pay:
 *
 * - "Tarjeta o efectivo": the Payment Brick (./PaymentBrick.tsx), with
 *   Mercado Pago's own form inside its iframe: credit, debit and prepaid
 *   cards with installments, and cash (Rapipago, Pago Fácil). Its own pay
 *   button is hidden: our "Revisar pedido" asks it for what it collected
 *   (getFormData: a single-use card token, the method, the installments, the
 *   payer's document), and the payment is only created on "Realizar pedido".
 * - "Cuenta de Mercado Pago" (account money and whatever the customer keeps
 *   there): Checkout Pro. The Brick would need a preference before the order
 *   exists and would send the customer away from this step, so "Realizar
 *   pedido" creates the preference instead and only then the browser goes to
 *   Mercado Pago (design doc, "Pagos").
 *
 * With PAYMENTS_MOCK=1 (tests, never production) a list of test options
 * stands in for the Brick, without loading Mercado Pago's SDK.
 */

const PaymentBrick = dynamic(() => import("./PaymentBrick").then((mod) => mod.PaymentBrick), {
  ssr: false,
  loading: () => <Skeleton className="h-96" />,
});

interface MercadoPagoPaymentProps {
  config: MercadoPagoClientConfig;
  shipping: ShippingInfo;
  /** The order's amount in pesos (the Brick shows installments for it). */
  amount: number;
  onSubmit: (payment: PaymentSummary) => void;
  onBack: () => void;
}

const newAttempt = () => crypto.randomUUID();

export function MercadoPagoPayment({ config, shipping, amount, onSubmit, onBack }: MercadoPagoPaymentProps) {
  if (config.mode === "mock") return <MercadoPagoMockPayment shipping={shipping} onSubmit={onSubmit} onBack={onBack} />;
  if (config.mode !== "mercadopago" || !config.publicKey) {
    return <PaymentsNotConfigured provider="Mercado Pago" missing={config.missing} onBack={onBack} />;
  }
  return <MercadoPagoLivePayment publicKey={config.publicKey} shipping={shipping} amount={amount} onSubmit={onSubmit} onBack={onBack} />;
}

type Way = "brick" | "wallet";

function WaySelector({ way, onChange }: { way: Way; onChange: (way: Way) => void }) {
  return (
    <Field label="¿Cómo quieres pagar?">
      <RadioGroup value={way} onValueChange={(value) => onChange(value as Way)}>
        <RadioGroupItem value="brick" label="Tarjeta o efectivo" description="Crédito, débito o prepaga, en cuotas; o efectivo en Rapipago y Pago Fácil." />
        <RadioGroupItem
          value="wallet"
          label="Cuenta de Mercado Pago"
          description="Con tu dinero en cuenta o los medios que guardaste en Mercado Pago."
        />
      </RadioGroup>
    </Field>
  );
}

function WalletNote() {
  return (
    <p className="flex items-start gap-3 rounded-xl border border-border bg-bg-subtle p-4 text-label font-normal text-fg-secondary" data-testid="mp-wallet-note">
      <Wallet aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
      <span>Cuando confirmes el pedido te llevamos a Mercado Pago para pagar, y después vuelves acá a ver el estado de tu pedido.</span>
    </p>
  );
}

const walletSummary = (): MercadoPagoPaymentSummary => ({
  provider: "MERCADOPAGO",
  attemptId: newAttempt(),
  method: "wallet",
  brand: "account_money",
  last4: null,
  installments: null,
});

function MercadoPagoLivePayment({ publicKey, shipping, amount, onSubmit, onBack }: { publicKey: string } & Omit<MercadoPagoPaymentProps, "config">) {
  const [way, setWay] = useState<Way>("brick");
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (way === "wallet") {
      onSubmit(walletSummary());
      return;
    }
    const controller = window.paymentBrickController;
    if (!controller) return;
    setBusy(true);
    try {
      // Validates the Brick's fields (it shows its own messages next to them) and tokenizes the card.
      const data = await controller.getFormData().catch(() => null);
      const formData = data?.formData as Record<string, unknown> | undefined;
      if (!data || !formData?.payment_method_id) {
        setError("Completa los datos del medio de pago para continuar.");
        return;
      }
      const additional = (data.additionalData ?? (await controller.getAdditionalData?.().catch(() => null))) as { lastFourDigits?: string } | null;
      const cash = data.paymentType === "ticket" || data.paymentType === "atm" || data.paymentType === "bank_transfer";
      onSubmit({
        provider: "MERCADOPAGO",
        attemptId: newAttempt(),
        method: cash ? "ticket" : "card",
        formData,
        brand: String(formData.payment_method_id),
        last4: cash ? null : (additional?.lastFourDigits ?? null),
        installments: cash ? null : typeof formData.installments === "number" ? formData.installments : 1,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate aria-labelledby="payment-title" className="space-y-5">
      <WaySelector way={way} onChange={setWay} />
      {error ? <FormAlert>{error}</FormAlert> : null}
      {way === "wallet" ? (
        <WalletNote />
      ) : loadFailed ? (
        <FormAlert>No pudimos cargar el formulario de pago. Revisa tu conexión y recarga la página.</FormAlert>
      ) : (
        <div className="relative min-h-96">
          {!ready ? <Skeleton aria-hidden="true" className="absolute inset-0" /> : null}
          <PaymentBrick publicKey={publicKey} shipping={shipping} amount={amount} onReady={() => setReady(true)} onLoadError={() => setLoadFailed(true)} />
        </div>
      )}
      <SecureNote>
        Los datos de la tarjeta los procesa Mercado Pago y nunca pasan por nuestros servidores. No se cobra nada hasta que confirmes el pedido
        en el paso siguiente.
      </SecureNote>
      <PaymentFooter onBack={onBack} disabled={way === "brick" && (!ready || loadFailed)} busy={busy} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Mock (PAYMENTS_MOCK=1: tests only)
// ---------------------------------------------------------------------------

type MockOption = `card:${MpMockCardId}` | `ticket:${MpMockTicketId}` | "wallet";

const MOCK_CARD_IDS = Object.keys(MP_MOCK_CARDS) as MpMockCardId[];
const MOCK_TICKET_IDS = Object.keys(MP_MOCK_TICKETS) as MpMockTicketId[];

function mockSummary(option: MockOption, shipping: ShippingInfo): MercadoPagoPaymentSummary {
  if (option === "wallet") return walletSummary();
  const [kind, id] = option.split(":") as ["card" | "ticket", string];
  if (kind === "ticket") {
    return {
      provider: "MERCADOPAGO",
      attemptId: newAttempt(),
      method: "ticket",
      formData: { payment_method_id: id, payer: { email: shipping.email, first_name: shipping.firstName, last_name: shipping.lastName } },
      brand: id,
      last4: null,
      installments: null,
    };
  }
  const card = MP_MOCK_CARDS[id as MpMockCardId];
  return {
    provider: "MERCADOPAGO",
    attemptId: newAttempt(),
    method: "card",
    formData: {
      token: mpMockToken(id as MpMockCardId),
      payment_method_id: card.paymentMethodId,
      installments: card.installments,
      payer: { email: shipping.email, identification: { type: "DNI", number: "12345678" } },
    },
    brand: card.paymentMethodId,
    last4: card.last4,
    installments: card.installments,
  };
}

function MercadoPagoMockPayment({ shipping, onSubmit, onBack }: Pick<MercadoPagoPaymentProps, "shipping" | "onSubmit" | "onBack">) {
  const [option, setOption] = useState<MockOption>("card:approved");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(mockSummary(option, shipping));
      }}
      aria-labelledby="payment-title"
      className="space-y-5"
      data-testid="mp-mock-payment"
    >
      <p className="flex items-start gap-3 rounded-xl border border-warning bg-bg-subtle p-4 text-label font-normal text-fg-secondary">
        <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg" />
        <span>
          <strong className="font-semibold text-fg">Modo de prueba.</strong> Los pagos son simulados (PAYMENTS_MOCK): no se contacta a Mercado
          Pago ni se cobra nada.
        </span>
      </p>
      <Field label="Medio de pago de prueba">
        <RadioGroup value={option} onValueChange={(value) => setOption(value as MockOption)}>
          {MOCK_CARD_IDS.map((id) => (
            <RadioGroupItem
              key={id}
              value={`card:${id}`}
              label={MP_MOCK_CARDS[id].label}
              description={<span className="font-mono">{MP_MOCK_CARDS[id].number}</span>}
            />
          ))}
          {MOCK_TICKET_IDS.map((id) => (
            <RadioGroupItem key={id} value={`ticket:${id}`} label={MP_MOCK_TICKETS[id].label} description="Genera un ticket para pagar en efectivo." />
          ))}
          <RadioGroupItem value="wallet" label="Cuenta de Mercado Pago" description="Te lleva a pagar a Mercado Pago (simulado)." />
        </RadioGroup>
      </Field>
      <PaymentFooter onBack={onBack} />
    </form>
  );
}
