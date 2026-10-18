"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { m } from "motion/react";
import { ArrowRight, CircleX, Mail, PackageSearch, Truck } from "lucide-react";
import { siteConfig } from "@/config/site";
import { STAGGER, STAGGER_DELAY, drawPath, scaleIn, staggerContainer, staggerItem, successPop } from "@/lib/motion";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS, cancelReasonLabel, formatOrderNumber, orderPaymentLabel } from "@/lib/orders/format";
import type { OrderView } from "@/lib/orders/types";
import { formatPrice } from "@/lib/utils";
import { Badge, Button, Spinner } from "@/components/ui";
import { OrderLines, orderLinesOf } from "./OrderLines";

interface ConfirmationStepProps {
  order: OrderView;
  /** True when the visitor is signed in as the order's owner ("Ver mi pedido"). */
  canViewInAccount: boolean;
  /** The status could not be refreshed for a while (shown as a hint, the polling goes on). */
  stale?: boolean;
}

const { deliveryDays } = siteConfig.commerce;

const HEADINGS = {
  waiting: "Estamos confirmando tu pago",
  paid: "¡Gracias por tu compra!",
  cancelled: "No pudimos completar tu pedido",
} as const;

/**
 * After "Realizar pedido": the real order number and its status. The bank
 * accepted the payment, but the order is only confirmed (PAID) when Stripe's
 * webhook arrives; CheckoutFlow polls the order and this re-renders. Its
 * heading is the page's h1 (the checkout header is gone by then); focus moves
 * to it so the outcome is announced, and status changes are announced too.
 */
export function ConfirmationStep({ order, canViewInAccount, stale = false }: ConfirmationStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  const phase = order.status === "PENDING" ? "waiting" : order.status === "CANCELLED" ? "cancelled" : "paid";
  const number = formatOrderNumber(order.number);

  return (
    <m.section
      aria-labelledby="confirmation-title"
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      data-testid="order-confirmation"
      data-status={order.status}
      className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-6 text-center shadow-card sm:p-10"
    >
      <m.div variants={staggerContainer(STAGGER, STAGGER_DELAY.step)} initial="hidden" animate="visible" className="flex flex-col items-center">
        <span aria-hidden="true" className="mb-6 flex size-20 items-center justify-center">
          {phase === "paid" ? (
            <m.span
              key="paid"
              variants={successPop}
              initial="hidden"
              animate="visible"
              className="flex size-20 items-center justify-center rounded-full bg-success text-on-success shadow-card"
            >
              <svg viewBox="0 0 24 24" fill="none" className="size-10" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <m.path d="M5 12.5l4.5 4.5L19 7.5" variants={drawPath} />
              </svg>
            </m.span>
          ) : phase === "cancelled" ? (
            <span className="flex size-20 items-center justify-center rounded-full bg-bg-muted text-danger">
              <CircleX className="size-10" />
            </span>
          ) : (
            <span className="flex size-20 items-center justify-center rounded-full bg-bg-muted text-fg">
              <Spinner className="size-9" />
            </span>
          )}
        </span>

        <m.h1
          variants={staggerItem}
          id="confirmation-title"
          ref={headingRef}
          tabIndex={-1}
          className="mb-2 scroll-mt-32 text-heading text-fg outline-none"
        >
          {HEADINGS[phase]}
        </m.h1>
        <m.p variants={staggerItem} role="status" className="mb-6 text-fg-secondary" data-testid="order-status-message">
          {phase === "paid"
            ? "Tu pedido está confirmado y ya lo estamos preparando."
            : phase === "cancelled"
              ? cancelReasonLabel(order.cancelReason)
              : stale
                ? "Tu banco aceptó el pago, pero la confirmación está tardando más de lo normal. Te avisaremos por email."
                : "Tu banco aceptó el pago. Esto suele tardar unos segundos."}
        </m.p>

        <m.dl variants={staggerItem} className="mb-6 grid w-full gap-3 rounded-xl bg-bg-subtle p-4 text-left sm:grid-cols-2">
          <div>
            <dt className="text-caption text-fg-muted">Número de pedido</dt>
            <dd className="font-mono text-title text-fg" data-testid="order-id">
              {number}
            </dd>
          </div>
          <div className="sm:text-right">
            <dt className="text-caption text-fg-muted">Estado</dt>
            <dd className="mt-1">
              <Badge variant={ORDER_STATUS_BADGE[order.status]} data-testid="order-status">
                {ORDER_STATUS_LABELS[order.status]}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-caption text-fg-muted">{phase === "paid" ? "Total pagado" : "Total"}</dt>
            <dd className="text-title text-fg tabular-nums" data-testid="order-total">
              {formatPrice(order.total)}
            </dd>
          </div>
          <div className="sm:text-right">
            <dt className="text-caption text-fg-muted">Pago</dt>
            <dd className="text-label text-fg">{orderPaymentLabel(order)}</dd>
          </div>
        </m.dl>

        <m.div variants={staggerItem} className="mb-6 w-full rounded-xl border border-border p-4">
          <OrderLines lines={orderLinesOf(order)} label="Productos del pedido" />
        </m.div>

        {phase !== "cancelled" ? (
          <m.ul variants={staggerItem} className="mb-8 w-full space-y-2 text-left text-label font-normal text-fg-secondary">
            <li className="flex items-start gap-2">
              <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
              <span>
                {phase === "paid" ? "Te enviamos la confirmación a " : "Te enviaremos la confirmación a "}
                <strong className="font-semibold text-fg">{order.email}</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Truck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
              <span>
                Llega en {deliveryDays.min} a {deliveryDays.max} días hábiles.
              </span>
            </li>
          </m.ul>
        ) : null}

        <m.div variants={staggerItem} className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" render={<Link href="/" />}>
            Seguir comprando
            <ArrowRight aria-hidden="true" />
          </Button>
          {canViewInAccount ? (
            <Button size="lg" variant="outline" render={<Link href={`/account/orders/${order.id}`} />}>
              <PackageSearch aria-hidden="true" />
              Ver mi pedido
            </Button>
          ) : (
            <Button size="lg" variant="outline" render={<Link href="/contacto" />}>
              ¿Necesitas ayuda?
            </Button>
          )}
        </m.div>
      </m.div>
    </m.section>
  );
}
