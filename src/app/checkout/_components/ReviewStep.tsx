"use client";

import Link from "next/link";
import { ChevronLeft, ClipboardCheck, CreditCard, Lock, MapPin, Pencil } from "lucide-react";
import { siteConfig } from "@/config/site";
import { CARD_BRAND_LABELS, maskedNumber } from "@/lib/card";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui";
import type { PaymentSummary, ShippingInfo } from "@/types";
import { StepCount, StepPanel } from "./StepPanel";

interface ReviewStepProps {
  shippingInfo: ShippingInfo;
  payment: PaymentSummary;
  /** Amount to be charged (shown next to the button so phones see it too). */
  total: number;
  focusHeading: boolean;
  isProcessing: boolean;
  onEditShipping: () => void;
  onEditPayment: () => void;
  onPlaceOrder: () => void;
}

const { deliveryDays } = siteConfig.commerce;

function ReviewBlock({
  title,
  icon,
  editLabel,
  onEdit,
  disabled,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  editLabel: string;
  onEdit: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-body font-semibold text-fg">
          <span aria-hidden="true" className="text-info [&_svg]:size-5">
            {icon}
          </span>
          {title}
        </h3>
        <Button variant="ghost" size="sm" onClick={onEdit} disabled={disabled} aria-label={editLabel}>
          <Pencil aria-hidden="true" />
          Editar
        </Button>
      </div>
      {children}
    </div>
  );
}

/** Step 3: what will be shipped where and how it is paid, then the order button. */
export function ReviewStep({
  shippingInfo,
  payment,
  total,
  focusHeading,
  isProcessing,
  onEditShipping,
  onEditPayment,
  onPlaceOrder,
}: ReviewStepProps) {
  return (
    <StepPanel
      titleId="review-title"
      title="Revisa tu pedido"
      icon={<ClipboardCheck />}
      focusHeading={focusHeading}
      aside={<StepCount index={2} total={3} />}
      aria-busy={isProcessing || undefined}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <ReviewBlock
          title="Envío"
          icon={<MapPin />}
          editLabel="Editar datos de envío"
          onEdit={onEditShipping}
          disabled={isProcessing}
        >
          <address className="space-y-0.5 text-sm text-fg-secondary not-italic" data-testid="review-shipping">
            <p className="font-medium text-fg">
              {shippingInfo.firstName} {shippingInfo.lastName}
            </p>
            <p>{shippingInfo.address}</p>
            <p>
              {shippingInfo.city}, {shippingInfo.state} {shippingInfo.zipCode}
            </p>
            <p>{shippingInfo.country}</p>
            <p className="pt-2">{shippingInfo.email}</p>
            <p>{shippingInfo.phone}</p>
          </address>
          <p className="mt-3 text-caption text-fg-muted">
            Llega en {deliveryDays.min} a {deliveryDays.max} días hábiles.
          </p>
        </ReviewBlock>

        <ReviewBlock
          title="Pago"
          icon={<CreditCard />}
          editLabel="Editar método de pago"
          onEdit={onEditPayment}
          disabled={isProcessing}
        >
          <div className="space-y-0.5 text-sm text-fg-secondary" data-testid="review-payment">
            <p className="font-medium text-fg">
              {CARD_BRAND_LABELS[payment.brand]} <span className="font-mono">{maskedNumber(payment.last4)}</span>
            </p>
            <p>{payment.cardName}</p>
            <p>Vence {payment.expiryDate}</p>
          </div>
        </ReviewBlock>
      </div>

      <div className="mt-6 flex items-baseline justify-between gap-4 rounded-xl bg-bg-subtle p-4">
        <span className="font-semibold text-fg">Total a pagar</span>
        <span className="text-title text-fg tabular-nums" data-testid="review-total">
          {formatPrice(total)}
        </span>
      </div>

      <p className="mt-4 text-caption text-fg-muted">
        Al confirmar aceptas los{" "}
        <Link href="/terminos" className="font-medium text-info underline underline-offset-4 hover:no-underline">
          términos y condiciones
        </Link>
        .
      </p>

      <p role="status" aria-live="polite" className="sr-only">
        {isProcessing ? "Procesando el pago…" : ""}
      </p>

      <div className="mt-5 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onEditPayment} disabled={isProcessing}>
          <ChevronLeft aria-hidden="true" />
          Volver a pago
        </Button>
        <Button size="lg" onClick={onPlaceOrder} loading={isProcessing} focusableWhenDisabled data-testid="place-order">
          {isProcessing ? null : <Lock aria-hidden="true" />}
          {isProcessing ? "Procesando…" : "Confirmar pedido"}
        </Button>
      </div>
    </StepPanel>
  );
}
