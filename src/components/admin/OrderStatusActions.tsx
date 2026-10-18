import { Ban, PackageCheck, Truck } from "lucide-react";
import { changeOrderStatusAction } from "@/lib/admin/actions";
import { ADMIN_TRANSITIONS } from "@/lib/admin/format";
import { formatOrderNumber } from "@/lib/orders/format";
import type { OrderStatus } from "@/lib/orders/types";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui";
import { ConfirmAction } from "./ConfirmAction";

interface OrderStatusActionsProps {
  order: {
    id: string;
    number: number;
    status: OrderStatus;
    total: number;
    email: string;
    /** A cancellation's refund has an unknown outcome: no shipping until it is cancelled again. */
    refundPending?: boolean;
    /** A pending order with a PaymentIntent: cancelling it cancels that payment in Stripe. */
    stripePaymentIntentId?: string | null;
  };
  /**
   * False when the server has no payment provider (paymentsMode "unconfigured"):
   * a cancellation that has to refund or cancel a payment in Stripe is then
   * shown disabled, with the reason, instead of failing after the dialog.
   */
  paymentsConfigured?: boolean;
}

/**
 * The status changes this order allows (ADMIN_TRANSITIONS), each behind a
 * confirmation that says what it does: email the customer, refund, put the
 * stock back. The action carries the status shown here, so if the order
 * moved meanwhile (the webhook, another admin) the server changes nothing.
 * An order held by a refund of unknown outcome only offers to retry the
 * cancellation (the server refuses to ship it too).
 */
export function OrderStatusActions({ order, paymentsConfigured = true }: OrderStatusActionsProps) {
  const number = formatOrderNumber(order.number);
  const held = order.status === "PAID" && order.refundPending === true;
  const next = ADMIN_TRANSITIONS[order.status].filter((to) => !(held && to === "SHIPPED"));
  if (next.length === 0) return null;
  // Cancelling refunds a paid order or cancels the pending payment: both go through Stripe.
  const cancelBlocked = !paymentsConfigured && (order.status === "PAID" || Boolean(order.stripePaymentIntentId));
  const cancelLabel = held ? "Reintentar la cancelación" : order.status === "PAID" ? "Cancelar y reembolsar" : "Cancelar pedido";
  const run = (to: (typeof next)[number]) => changeOrderStatusAction.bind(null, { orderId: order.id, to, expected: order.status });

  return (
    <div className="space-y-3">
      {held ? (
        <p className="rounded-xl bg-bg-subtle p-4 text-label font-normal text-fg-secondary" data-testid="order-refund-pending">
          <span className="font-semibold text-fg">Reembolso sin confirmar: </span>
          pedimos el reembolso a Stripe pero no pudimos confirmar si se hizo. El pedido queda retenido y no se puede enviar: reintenta la
          cancelación para cerrarlo (nunca se reembolsa dos veces).
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2" data-testid="order-actions">
        {next.includes("SHIPPED") ? (
          <ConfirmAction
            label="Marcar como enviado"
            icon={<Truck aria-hidden="true" />}
            variant="primary"
            size="md"
            title={`¿Marcar ${number} como enviado?`}
            description={`Le mandamos un email a ${order.email} avisando que su pedido está en camino. Un pedido enviado ya no se puede cancelar.`}
            confirmLabel="Marcar como enviado"
            action={run("SHIPPED")}
          />
        ) : null}
        {next.includes("DELIVERED") ? (
          <ConfirmAction
            label="Marcar como entregado"
            icon={<PackageCheck aria-hidden="true" />}
            variant="primary"
            size="md"
            title={`¿Marcar ${number} como entregado?`}
            description="Es el último paso del pedido: no se puede deshacer."
            confirmLabel="Marcar como entregado"
            action={run("DELIVERED")}
          />
        ) : null}
        {next.includes("CANCELLED") && cancelBlocked ? (
          <Button variant="secondary" size="md" disabled aria-describedby="order-cancel-blocked">
            <Ban aria-hidden="true" />
            {cancelLabel}
          </Button>
        ) : null}
        {next.includes("CANCELLED") && !cancelBlocked ? (
          <ConfirmAction
            label={cancelLabel}
            icon={<Ban aria-hidden="true" />}
            variant="secondary"
            size="md"
            title={`¿Cancelar ${number}?`}
            description={
              order.status === "PAID" ? (
                <p>
                  Reembolsamos {formatPrice(order.total)} en Stripe a la tarjeta del cliente y devolvemos el stock de sus productos. No se puede
                  deshacer.
                </p>
              ) : (
                <p>Todavía no se cobró: cancelamos el pago pendiente en Stripe, así ya no se puede pagar. No se puede deshacer.</p>
              )
            }
            confirmLabel={order.status === "PAID" ? "Cancelar y reembolsar" : "Cancelar pedido"}
            confirmVariant="destructive"
            action={run("CANCELLED")}
          />
        ) : null}
      </div>
      {next.includes("CANCELLED") && cancelBlocked ? (
        <p id="order-cancel-blocked" className="text-caption text-fg-muted" data-testid="order-cancel-blocked">
          Los pagos no están configurados en este servidor: cancelar este pedido necesita Stripe para{" "}
          {order.status === "PAID" ? "reembolsar el pago" : "cancelar el pago pendiente"}.
        </p>
      ) : null}
    </div>
  );
}
