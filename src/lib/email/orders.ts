import { siteConfig } from "@/config/site";
import { formatOrderNumber, paymentLabel } from "@/lib/orders/format";
import type { OrderView } from "@/lib/orders/types";
import { formatPrice } from "@/lib/utils";
import type { EmailMessage } from "./send";

/*
 * Order emails (Spanish, tuteo): confirmation when an order is paid, and
 * "on its way" when the store ships it. Plain HTML with inline styles and
 * tables, which is what email clients render reliably; the colours are the
 * store's light theme written out (emails cannot read CSS variables).
 */

const COLORS = {
  page: "#f5f4f2",
  card: "#ffffff",
  text: "#1c1917",
  muted: "#57534e",
  border: "#e7e5e4",
  brand: "#ffd44a",
} as const;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

function siteUrl(path = "/") {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim() || siteConfig.url;
  return new URL(path, base).toString();
}

/** Absolute image URL (the order snapshots keep site-relative paths). */
const imageUrl = (src: string) => (/^https?:\/\//.test(src) ? src : siteUrl(src));

function orderLink(order: OrderView) {
  return order.hasAccount ? siteUrl(`/account/orders/${order.id}`) : null;
}

function linesTable(order: OrderView) {
  const rows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid ${COLORS.border};width:64px">
          <img src="${escapeHtml(imageUrl(item.image))}" alt="" width="56" height="56" style="display:block;border-radius:8px;background:${COLORS.page};object-fit:contain" />
        </td>
        <td style="padding:12px;border-bottom:1px solid ${COLORS.border};color:${COLORS.text}">
          <strong>${escapeHtml(item.name)}</strong><br />
          <span style="color:${COLORS.muted};font-size:13px">Cantidad: ${item.quantity} × ${formatPrice(item.unitPrice)}</span>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid ${COLORS.border};text-align:right;white-space:nowrap;color:${COLORS.text}">
          ${formatPrice(item.unitPrice * item.quantity)}
        </td>
      </tr>`
    )
    .join("");
  const total = (label: string, value: string, strong = false) => `
      <tr>
        <td colspan="2" style="padding:4px 0;color:${strong ? COLORS.text : COLORS.muted};${strong ? "font-weight:700;font-size:16px" : ""}">${label}</td>
        <td style="padding:4px 0;text-align:right;color:${COLORS.text};${strong ? "font-weight:700;font-size:16px" : ""}">${value}</td>
      </tr>`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
      ${rows}
      <tr><td colspan="3" style="height:12px"></td></tr>
      ${total("Subtotal", formatPrice(order.subtotal))}
      ${total("Envío", order.shipping === 0 ? "Gratis" : formatPrice(order.shipping))}
      ${total("Total", formatPrice(order.total), true)}
    </table>`;
}

function addressBlock(order: OrderView) {
  const a = order.shippingAddress;
  return [`${a.firstName} ${a.lastName}`, a.address, `${a.city}, ${a.state} ${a.zipCode}`, a.country, a.phone].map(escapeHtml).join("<br />");
}

function layout({ preheader, title, intro, body, cta }: { preheader: string; title: string; intro: string; body: string; cta: { label: string; href: string } | null }) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${COLORS.page};font-family:Barlow,Helvetica,Arial,sans-serif;color:${COLORS.text}">
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page}">
      <tr>
        <td align="center" style="padding:24px 12px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${COLORS.card};border-radius:16px;overflow:hidden;border:1px solid ${COLORS.border}">
            <tr>
              <td style="background:${COLORS.brand};padding:20px 24px;font-size:20px;font-weight:800;color:${COLORS.text}">LEGO Store</td>
            </tr>
            <tr>
              <td style="padding:28px 24px 8px">
                <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;color:${COLORS.text}">${escapeHtml(title)}</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:${COLORS.muted}">${intro}</p>
                ${body}
                ${
                  cta
                    ? `<p style="margin:28px 0 8px"><a href="${escapeHtml(cta.href)}" style="display:inline-block;background:${COLORS.brand};color:${COLORS.text};font-weight:700;text-decoration:none;padding:12px 20px;border-radius:10px">${escapeHtml(cta.label)}</a></p>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 28px;font-size:12px;line-height:1.5;color:${COLORS.muted}">
                ¿Dudas con tu pedido? Responde este email o escríbenos desde <a href="${siteUrl("/contacto")}" style="color:${COLORS.text}">${escapeHtml(siteUrl("/contacto"))}</a>.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function textLines(order: OrderView) {
  return [
    ...order.items.map((item) => `- ${item.name} × ${item.quantity}: ${formatPrice(item.unitPrice * item.quantity)}`),
    "",
    `Subtotal: ${formatPrice(order.subtotal)}`,
    `Envío: ${order.shipping === 0 ? "Gratis" : formatPrice(order.shipping)}`,
    `Total: ${formatPrice(order.total)}`,
  ].join("\n");
}

const { deliveryDays } = siteConfig.commerce;

/** "Recibimos tu pago": sent when the order becomes PAID. */
export function orderConfirmationEmail(order: OrderView): EmailMessage {
  const number = formatOrderNumber(order.number);
  const link = orderLink(order);
  const intro = `Hola ${escapeHtml(order.shippingAddress.firstName)}, recibimos el pago de tu pedido <strong>${number}</strong> y ya lo estamos preparando. Llega en ${deliveryDays.min} a ${deliveryDays.max} días hábiles.`;
  const body = `
    ${linesTable(order)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;font-size:14px;line-height:1.5">
      <tr>
        <td style="vertical-align:top;padding-right:12px">
          <strong>Envío a</strong><br /><span style="color:${COLORS.muted}">${addressBlock(order)}</span>
        </td>
        <td style="vertical-align:top">
          <strong>Pago</strong><br /><span style="color:${COLORS.muted}">${escapeHtml(paymentLabel(order.paymentBrand, order.paymentLast4))}</span>
        </td>
      </tr>
    </table>`;
  return {
    to: order.email,
    subject: `Confirmamos tu pedido ${number}`,
    html: layout({
      preheader: `Recibimos tu pago de ${formatPrice(order.total)}.`,
      title: "¡Gracias por tu compra!",
      intro,
      body,
      cta: link ? { label: "Ver mi pedido", href: link } : null,
    }),
    text: [
      `¡Gracias por tu compra, ${order.shippingAddress.firstName}!`,
      `Recibimos el pago de tu pedido ${number} y ya lo estamos preparando. Llega en ${deliveryDays.min} a ${deliveryDays.max} días hábiles.`,
      "",
      textLines(order),
      "",
      `Pago: ${paymentLabel(order.paymentBrand, order.paymentLast4)}`,
      link ? `Tu pedido: ${link}` : "",
    ]
      .filter((line, index, all) => line !== "" || all[index - 1] !== "")
      .join("\n"),
    idempotencyKey: `order-paid/${order.id}`,
  };
}

/** "Tu pedido está en camino": sent when the store marks the order SHIPPED. */
export function orderShippedEmail(order: OrderView): EmailMessage {
  const number = formatOrderNumber(order.number);
  const link = orderLink(order);
  const intro = `Hola ${escapeHtml(order.shippingAddress.firstName)}, tu pedido <strong>${number}</strong> salió hacia tu dirección. Llega en ${deliveryDays.min} a ${deliveryDays.max} días hábiles.`;
  const body = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.5"><strong>Lo enviamos a</strong><br /><span style="color:${COLORS.muted}">${addressBlock(order)}</span></p>
    ${linesTable(order)}`;
  return {
    to: order.email,
    subject: `Tu pedido ${number} está en camino`,
    html: layout({
      preheader: `Tu pedido ${number} ya salió.`,
      title: "Tu pedido está en camino",
      intro,
      body,
      cta: link ? { label: "Seguir mi pedido", href: link } : null,
    }),
    text: [
      `Hola ${order.shippingAddress.firstName}, tu pedido ${number} está en camino.`,
      `Llega en ${deliveryDays.min} a ${deliveryDays.max} días hábiles.`,
      "",
      textLines(order),
      link ? `\nTu pedido: ${link}` : "",
    ].join("\n"),
    idempotencyKey: `order-shipped/${order.id}`,
  };
}
