import { siteConfig } from "@/config/site";
import { CONTACT_TOPICS } from "@/lib/validations/contact-options";
import type { EmailMessage } from "./send";

/*
 * The contact form's notice to the store (a new message in the inbox), the
 * newsletter's welcome with its unsubscribe link, and the confirmation an
 * address that unsubscribed gets when someone signs it up again. Plain HTML with inline
 * styles (the store's light theme written out, as in ./orders.ts); every
 * value from a visitor is escaped.
 */

const COLORS = { page: "#f5f4f2", card: "#ffffff", text: "#1c1917", muted: "#57534e", border: "#e7e5e4", brand: "#ffd44a" } as const;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function siteUrl(path = "/") {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim() || siteConfig.url;
  return new URL(path, base).toString();
}

function layout(title: string, body: string, footer: string) {
  return `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(title)}</title></head>
  <body style="margin:0;padding:0;background:${COLORS.page};font-family:Barlow,Helvetica,Arial,sans-serif;color:${COLORS.text}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page}">
      <tr><td align="center" style="padding:24px 12px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${COLORS.card};border-radius:16px;overflow:hidden;border:1px solid ${COLORS.border}">
          <tr><td style="background:${COLORS.brand};padding:20px 24px;font-size:20px;font-weight:800;color:${COLORS.text}">${escapeHtml(siteConfig.name)}</td></tr>
          <tr><td style="padding:28px 24px 8px">
            <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:${COLORS.text}">${escapeHtml(title)}</h1>
            ${body}
          </td></tr>
          <tr><td style="padding:20px 24px 28px;font-size:12px;line-height:1.5;color:${COLORS.muted}">${footer}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

const topicLabel = (topic: string) => CONTACT_TOPICS.find((option) => option.value === topic)?.label ?? topic;

export interface ContactNotice {
  id: string;
  topic: string;
  name: string;
  email: string;
  orderNumber: string | null;
  message: string;
}

/** To the store: a new message, with a link to it in the admin and Reply-To-friendly details. */
export function contactNotificationEmail(to: string, message: ContactNotice): EmailMessage {
  const adminUrl = siteUrl(`/admin/mensajes/${message.id}`);
  const subject = `Nuevo mensaje de contacto: ${topicLabel(message.topic)}`;
  const rows: [string, string][] = [
    ["De", `${message.name} <${message.email}>`],
    ["Motivo", topicLabel(message.topic)],
    ...(message.orderNumber ? ([["Pedido", message.orderNumber]] as [string, string][]) : []),
  ];
  const html = layout(
    subject,
    `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5;margin-bottom:16px">
      ${rows.map(([label, value]) => `<tr><td style="padding:2px 12px 2px 0;color:${COLORS.muted}">${label}</td><td style="padding:2px 0">${escapeHtml(value)}</td></tr>`).join("")}
    </table>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;white-space:pre-wrap;border-left:3px solid ${COLORS.brand};padding-left:12px">${escapeHtml(message.message)}</p>
    <p style="margin:0 0 8px"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:${COLORS.brand};color:${COLORS.text};font-weight:700;text-decoration:none;padding:12px 20px;border-radius:10px">Ver en la bandeja</a></p>`,
    "Lo recibiste porque es el email de avisos de la tienda (STORE_NOTIFY_EMAIL o el email de contacto de la configuración)."
  );
  const text = [subject, "", ...rows.map(([label, value]) => `${label}: ${value}`), "", message.message, "", `Ver en la bandeja: ${adminUrl}`].join("\n");
  return { to, subject, html, text, idempotencyKey: `contact-message/${message.id}` };
}

/** To a new subscriber: welcome, and the link that unsubscribes them. */
export function newsletterWelcomeEmail(to: string, token: string): EmailMessage {
  const unsubscribeUrl = siteUrl(`/newsletter/baja?token=${encodeURIComponent(token)}`);
  const subject = `Te sumaste al newsletter de ${siteConfig.name}`;
  const html = layout(
    "¡Bienvenido al newsletter!",
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.muted}">Te vamos a escribir con lanzamientos, ofertas y novedades de la tienda. Nada más.</p>
     <p style="margin:0 0 8px"><a href="${escapeHtml(siteUrl("/"))}" style="display:inline-block;background:${COLORS.brand};color:${COLORS.text};font-weight:700;text-decoration:none;padding:12px 20px;border-radius:10px">Ir a la tienda</a></p>`,
    `¿No pediste esta suscripción o ya no quieres recibirla? <a href="${escapeHtml(unsubscribeUrl)}" style="color:${COLORS.text}">Date de baja</a>.`
  );
  const text = [
    "¡Bienvenido al newsletter!",
    "",
    "Te vamos a escribir con lanzamientos, ofertas y novedades de la tienda.",
    "",
    `Para darte de baja: ${unsubscribeUrl}`,
  ].join("\n");
  return { to, subject, html, text };
}

/** To an address that unsubscribed and was signed up again: nothing changes unless its owner confirms. */
export function newsletterConfirmEmail(to: string, token: string): EmailMessage {
  const confirmUrl = siteUrl(`/newsletter/confirmar?token=${encodeURIComponent(token)}`);
  const subject = `Confirma tu suscripción al newsletter de ${siteConfig.name}`;
  const html = layout(
    "¿Vuelves al newsletter?",
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.muted}">Alguien pidió suscribir este email al newsletter. Como te habías dado de baja, no te vamos a escribir hasta que lo confirmes.</p>
     <p style="margin:0 0 8px"><a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:${COLORS.brand};color:${COLORS.text};font-weight:700;text-decoration:none;padding:12px 20px;border-radius:10px">Confirmar la suscripción</a></p>`,
    "¿No fuiste tú? Ignora este email: sigues dado de baja y el enlace vence en 7 días."
  );
  const text = [
    "¿Vuelves al newsletter?",
    "",
    "Alguien pidió suscribir este email al newsletter. Como te habías dado de baja, no te vamos a escribir hasta que lo confirmes.",
    "",
    `Para confirmar: ${confirmUrl}`,
    "",
    "¿No fuiste tú? Ignora este email: sigues dado de baja y el enlace vence en 7 días.",
  ].join("\n");
  return { to, subject, html, text };
}
