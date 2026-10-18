import { Clock, ExternalLink, ReceiptText } from "lucide-react";
import { cardBrandLabel, formatTicketExpiry } from "@/lib/orders/format";
import type { OrderView } from "@/lib/orders/types";
import { pendingMessage } from "@/lib/payments/mercadopago/status";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui";

/**
 * What a customer needs while their payment is pending (PAYMENT_PENDING,
 * Mercado Pago): for a cash ticket, how much to pay where and until when,
 * with the ticket's link; for a card under review, that we will email them.
 * Shown on the checkout's confirmation and on the order's page.
 */
export function PendingPaymentNotice({ order, className }: { order: Pick<OrderView, "total" | "paymentBrand" | "payment">; className?: string }) {
  const { methodType, ticketUrl, ticketExpiresAt } = order.payment;
  if (methodType !== "ticket") {
    return (
      <p className={`flex items-start gap-3 rounded-xl bg-bg-subtle p-4 text-left text-label font-normal text-fg-secondary ${className ?? ""}`} data-testid="pending-payment">
        <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
        <span>{pendingMessage(methodType, null)}</span>
      </p>
    );
  }
  return (
    <div className={`space-y-3 rounded-xl border border-border bg-bg-subtle p-4 text-left ${className ?? ""}`} data-testid="pending-payment">
      <p className="flex items-start gap-3 text-label font-normal text-fg-secondary">
        <ReceiptText aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
        <span>
          Paga <strong className="font-semibold text-fg tabular-nums">{formatPrice(order.total)}</strong> en efectivo en{" "}
          <strong className="font-semibold text-fg">{cardBrandLabel(order.paymentBrand)}</strong>
          {ticketExpiresAt ? (
            <>
              {" "}
              antes del <strong className="font-semibold text-fg" data-testid="ticket-expiry">{formatTicketExpiry(ticketExpiresAt)}</strong>
            </>
          ) : null}
          . Cuando se acredite te confirmamos el pedido por email; si el ticket vence sin pagarse, cancelamos el pedido sin costo.
        </span>
      </p>
      {ticketUrl ? (
        <Button variant="outline" size="sm" render={<a href={ticketUrl} target="_blank" rel="noopener noreferrer" data-testid="ticket-link" />}>
          Ver el ticket de pago
          <span className="sr-only"> (se abre en otra pestaña)</span>
          <ExternalLink aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
