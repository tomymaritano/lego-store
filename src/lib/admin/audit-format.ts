import { ADMIN_ORDER_STATUS_LABELS } from "@/lib/orders/format";
import type { OrderStatus } from "@/lib/orders/types";
import { formatPrice } from "@/lib/utils";
import type { AuditEntityType } from "@/lib/validations/audit";
import { ANNOUNCEMENT_TONE_LABELS, type AnnouncementTone } from "@/lib/settings/defaults";
import { couponDateInput, formatAdminDateTime } from "./format";

/*
 * How the admin reads the audit log (src/lib/admin/audit.ts): what each
 * action and field is called, and an entry's changes in words. Client-safe.
 */

export const AUDIT_ENTITY_LABELS: Record<AuditEntityType, string> = {
  product: "Producto",
  order: "Pedido",
  review: "Reseña",
  coupon: "Cupón",
  user: "Usuario",
  category: "Categoría",
  theme: "Tema",
  upload: "Imagen",
  settings: "Configuración",
  content: "Página de contenido",
  message: "Mensaje",
  subscriber: "Suscriptor",
  export: "Exportación",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "product.create": "Creó el producto",
  "product.update": "Editó el producto",
  "product.stock": "Cambió el stock",
  "product.archive": "Archivó el producto",
  "product.restore": "Restauró el producto",
  "product.delete": "Eliminó el producto",
  "order.ship": "Marcó el pedido como enviado",
  "order.deliver": "Marcó el pedido como entregado",
  "order.cancel": "Canceló el pedido",
  "review.delete": "Eliminó la reseña",
  "coupon.create": "Creó el cupón",
  "coupon.update": "Editó el cupón",
  "coupon.activate": "Activó el cupón",
  "coupon.deactivate": "Desactivó el cupón",
  "user.role": "Cambió el rol",
  "user.block": "Bloqueó la cuenta",
  "user.unblock": "Desbloqueó la cuenta",
  "category.create": "Creó la categoría",
  "category.update": "Editó la categoría",
  "category.reorder": "Movió la categoría",
  "category.delete": "Eliminó la categoría",
  "theme.create": "Creó el tema",
  "theme.update": "Editó el tema",
  "theme.reorder": "Movió el tema",
  "theme.delete": "Eliminó el tema",
  "upload.create": "Subió una imagen",
  "settings.shipping": "Cambió el envío",
  "settings.announcement": "Cambió la barra de anuncio",
  "settings.contact": "Cambió los datos de contacto",
  "settings.featured": "Cambió los destacados de la home",
  "content.draft": "Guardó un borrador",
  "content.publish": "Publicó la página",
  "content.discard": "Descartó el borrador",
  "message.read": "Marcó el mensaje como leído",
  "message.unread": "Marcó el mensaje como no leído",
  "message.archive": "Archivó el mensaje",
  "subscriber.unsubscribe": "Dio de baja al suscriptor del newsletter",
  "export.orders": "Exportó los pedidos",
  "export.customers": "Exportó los clientes",
  "export.newsletter": "Exportó los suscriptores",
  "export.messages": "Exportó los mensajes de contacto",
};

export const auditActionLabel = (action: string) => AUDIT_ACTION_LABELS[action] ?? action;

/** The fields an entry can name, as the admin reads them (shared by every entity). */
const FIELD_LABELS: Record<string, string> = {
  // Products
  name: "nombre",
  price: "precio",
  originalPrice: "precio anterior",
  isNew: "nuevo",
  isOnSale: "en oferta",
  categoryId: "categoría",
  themeId: "tema",
  theme: "tema",
  type: "tipo",
  age: "edad",
  interests: "intereses",
  pieces: "piezas",
  highlight: "destacado",
  img: "imagen principal",
  imageSecondary: "imagen al pasar el mouse",
  images: "galería",
  imageAlts: "textos alternativos",
  stock: "stock",
  shortDescription: "descripción corta",
  description: "descripción",
  archived: "archivado",
  // Orders
  status: "estado",
  refundId: "reembolso",
  // Reviews
  productId: "producto",
  author: "autor",
  rating: "estrellas",
  title: "título",
  comment: "comentario",
  // Coupons
  code: "código",
  value: "valor",
  minSubtotal: "compra mínima",
  startsAt: "válido desde",
  expiresAt: "vence",
  maxRedemptions: "límite total",
  maxPerUser: "límite por cliente",
  active: "activo",
  // Users
  role: "rol",
  blocked: "bloqueado",
  reason: "motivo",
  // Categories and themes
  slug: "slug",
  image: "imagen",
  imageAlt: "texto alternativo",
  position: "posición",
  visible: "visible",
  // Uploads
  url: "URL",
  alt: "texto alternativo",
  bytes: "tamaño",
  // Store settings
  shippingCost: "costo del envío",
  freeShippingFrom: "envío gratis desde",
  announcementActive: "barra de anuncio activa",
  announcementText: "texto del anuncio",
  announcementLinkUrl: "enlace del anuncio",
  announcementLinkLabel: "texto del enlace",
  announcementTone: "color del anuncio",
  contactEmail: "email de contacto",
  contactPhone: "teléfono",
  contactAddress: "ubicación",
  contactHours: "horario",
  socialFacebook: "Facebook",
  socialInstagram: "Instagram",
  socialYoutube: "YouTube",
  socialX: "X",
  featured: "destacados",
  // Exports
  rows: "filas",
  filters: "filtros",
  // Content pages
  blocks: "bloques",
};

/** Where an entity calls a field something else. */
const ENTITY_FIELD_LABELS: Partial<Record<string, Record<string, string>>> = {
  coupon: { description: "nota" },
  content: { description: "introducción" },
};

export const auditFieldLabel = (field: string, entityType = "") => ENTITY_FIELD_LABELS[entityType]?.[field] ?? FIELD_LABELS[field] ?? field;

const ROLE_LABELS: Record<string, string> = { USER: "Cliente", ADMIN: "Admin" };
const MESSAGE_STATUS: Record<string, string> = { NEW: "Nuevo", READ: "Leído", ARCHIVED: "Archivado" };
const MONEY_FIELDS = new Set(["price", "originalPrice", "minSubtotal", "shippingCost", "freeShippingFrom"]);
/** Long texts: an entry says they changed, not what they say. */
const LONG_TEXT = 80;

function show(field: string, value: unknown, entityType: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "sí" : "no";
  if (Array.isArray(value)) return value.length === 0 ? "—" : value.map((item) => show(field, item, entityType)).join(", ");
  if (typeof value === "number") return MONEY_FIELDS.has(field) ? formatPrice(value) : value.toLocaleString("es-AR");
  const text = String(value);
  if (field === "status" && entityType === "order" && Object.hasOwn(ADMIN_ORDER_STATUS_LABELS, text)) {
    return ADMIN_ORDER_STATUS_LABELS[text as OrderStatus];
  }
  if (field === "role" && ROLE_LABELS[text]) return ROLE_LABELS[text];
  if (field === "status" && entityType === "message" && MESSAGE_STATUS[text]) return MESSAGE_STATUS[text];
  if (field === "announcementTone" && Object.hasOwn(ANNOUNCEMENT_TONE_LABELS, text)) return ANNOUNCEMENT_TONE_LABELS[text as AnnouncementTone];
  if (entityType === "coupon" && (field === "startsAt" || field === "expiresAt")) return couponDateInput(text, field === "expiresAt" ? "end" : "start");
  if (/At$/.test(field) && !Number.isNaN(Date.parse(text))) return formatAdminDateTime(text);
  return text.length > LONG_TEXT ? `${text.slice(0, LONG_TEXT - 1)}…` : text;
}

/** Fields whose edits only say they changed: the values are long, or lists. */
const NAME_ONLY = new Set(["description", "shortDescription", "comment", "images", "imageAlts", "interests", "featured", "blocks"]);

/** What a creation or a deletion shows of the record it saved (the rest is in the entry). */
const SUMMARY_FIELDS = new Set(["name", "code", "slug", "email", "price", "stock", "categoryId", "theme", "url", "author", "rating", "title", "productId"]);

/** Entries that saved a whole record (a creation, a deletion) instead of [before, after] pairs. */
const isSnapshot = (action: string) => /\.(create|delete)$/.test(action);

/**
 * An entry's changes in words, one line per field: "precio: $ 1.500 → $ 1.299"
 * for an edit, "nombre: Taj Mahal" for what a creation or a deletion saved.
 */
export function describeAuditChanges(entry: { action: string; entityType: string; changes: Record<string, unknown> | null }): string[] {
  const { action, entityType, changes } = entry;
  if (!changes) return [];
  if (isSnapshot(action)) {
    return Object.entries(changes)
      .filter(([field]) => SUMMARY_FIELDS.has(field))
      .map(([field, value]) => `${auditFieldLabel(field, entityType)}: ${show(field, value, entityType)}`);
  }
  return Object.entries(changes).map(([field, value]) => {
    const label = auditFieldLabel(field, entityType);
    if (!Array.isArray(value) || value.length !== 2) return `${label}: ${show(field, value, entityType)}`;
    if (NAME_ONLY.has(field)) return `${label}: cambió`;
    return `${label}: ${show(field, value[0], entityType)} → ${show(field, value[1], entityType)}`;
  });
}

/** Where the admin panel shows the record an entry is about (null when it has no page). */
export function auditEntityHref(entityType: string, entityId: string): string | null {
  const id = encodeURIComponent(entityId);
  switch (entityType) {
    case "product":
      return `/admin/products/${id}`;
    case "order":
      return `/admin/orders/${id}`;
    case "coupon":
      return `/admin/coupons/${id}`;
    case "user":
      return `/admin/users/${id}`;
    case "category":
      return `/admin/categories/${id}`;
    case "theme":
      return `/admin/themes/${id}`;
    case "settings":
      return "/admin/configuracion";
    case "content":
      return `/admin/contenido/${id}`;
    case "message":
      return `/admin/mensajes/${id}`;
    case "subscriber":
      return "/admin/newsletter";
    default:
      return null;
  }
}
