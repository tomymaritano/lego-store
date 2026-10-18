import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { formatAdminDateTime } from "@/lib/admin/format";
import type { AdminOrderRow } from "@/lib/admin/orders";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS, formatOrderNumber } from "@/lib/orders/format";
import { formatPrice } from "@/lib/utils";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

/** Orders as a table (admin list, dashboard): the number links to the order. */
export function OrdersTable({ orders, label }: { orders: AdminOrderRow[]; label: string }) {
  return (
    <Table label={label} data-testid="admin-orders">
      <TableHeader>
        <TableRow>
          <TableHead>Pedido</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Unidades</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id} data-testid="admin-order-row">
            <TableCell className="whitespace-nowrap">
              <Link href={`/admin/orders/${order.id}`} prefetch={false} className="font-mono font-semibold text-fg underline-offset-4 hover:underline">
                {formatOrderNumber(order.number)}
              </Link>
            </TableCell>
            <TableCell className="whitespace-nowrap text-fg-secondary">
              {formatAdminDateTime(order.submittedAt ?? order.createdAt)}
              {order.submittedAt ? null : <span className="block text-caption text-fg-muted">Sin intento de pago</span>}
            </TableCell>
            <TableCell className="max-w-64">
              <span className="block truncate">{order.customer}</span>
              <span className="block truncate text-caption text-fg-muted">
                {order.email}
                {order.hasAccount ? null : " · invitado"}
              </span>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Badge variant={ORDER_STATUS_BADGE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
              {order.cancelReason === "amount_mismatch" ? (
                <span className="mt-1 flex items-center gap-1 text-caption font-semibold text-danger">
                  <TriangleAlert aria-hidden="true" className="size-3.5" />
                  Monto distinto
                </span>
              ) : null}
            </TableCell>
            <TableCell className="text-right tabular-nums">{order.itemCount}</TableCell>
            <TableCell className="text-right font-semibold whitespace-nowrap tabular-nums">{formatPrice(order.total)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
