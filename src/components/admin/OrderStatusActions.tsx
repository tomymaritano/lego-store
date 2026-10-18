import { Ban, PackageCheck, Truck } from "lucide-react";
import { changeOrderStatusAction } from "@/lib/admin/actions";
import { ADMIN_TRANSITIONS } from "@/lib/admin/format";
import { formatOrderNumber } from "@/lib/orders/format";
import type { OrderStatus } from "@/lib/orders/types";
import { formatPrice } from "@/lib/utils";
import { ConfirmAction } from "./ConfirmAction";

interface OrderStatusActionsProps {
  order: { id: string; number: number; status: OrderStatus; total: number; email: string };
}

/**
 * The status changes this order allows (ADMIN_TRANSITIONS), each behind a
 * confirmation that says what it does: email the customer, refund, put the
 * stock back. The action carries the status shown here, so if the order
 * moved meanwhile (the webhook, another admin) the server changes nothing.
 */
export function OrderStatusActions({ order }: OrderStatusActionsProps) {
  const number = formatOrderNumber(order.number);
  const next = ADMIN_TRANSITIONS[order.status];
  if (next.length === 0) return null;
  const run = (to: (typeof next)[number]) => changeOrderStatusAction.bind(null, { orderId: order.id, to, expected: order.status });

  return (
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
      {next.includes("CANCELLED") ? (
        <ConfirmAction
          label={order.status === "PAID" ? "Cancelar y reembolsar" : "Cancelar pedido"}
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
  );
}
