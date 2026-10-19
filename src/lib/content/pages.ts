/*
 * The info pages whose content lives in the database (ContentPage, edited in
 * /admin/contenido). The slug is the row's key and the page's path. What
 * each page adds around its content stays in code: the FAQ's contact box
 * and structured data, the shipping page's figures from the settings, the
 * stats of "Sobre nosotros", the contact form. Client-safe.
 */

export const CONTENT_SLUGS = ["faq", "envios", "devoluciones", "nosotros", "privacidad", "terminos", "contacto"] as const;
export type ContentSlug = (typeof CONTENT_SLUGS)[number];

export interface ContentPageInfo {
  slug: ContentSlug;
  /** Where the page is. */
  path: string;
  /** Its name in the admin. */
  label: string;
  /** "legal": numbered sections from the Markdown's ## headings, with a table of contents and the publication date. */
  layout: "info" | "legal";
  /** What the admin is told the page adds on its own. */
  note?: string;
}

export const CONTENT_PAGES: Record<ContentSlug, ContentPageInfo> = {
  faq: { slug: "faq", path: "/faq", label: "Preguntas frecuentes", layout: "info", note: "Debajo va el recuadro «¿Te quedó alguna duda?» con el enlace a contacto." },
  envios: { slug: "envios", path: "/envios", label: "Envíos y entregas", layout: "info", note: "Arriba van tres datos que salen de la configuración: envío gratis, costo y plazo." },
  devoluciones: { slug: "devoluciones", path: "/devoluciones", label: "Cambios y devoluciones", layout: "info", note: "Debajo van los botones a contacto y a preguntas frecuentes." },
  nosotros: { slug: "nosotros", path: "/nosotros", label: "Sobre nosotros", layout: "info", note: "Arriba van las cifras del catálogo; debajo, los botones a la tienda y a contacto." },
  privacidad: { slug: "privacidad", path: "/privacidad", label: "Política de privacidad", layout: "legal" },
  terminos: { slug: "terminos", path: "/terminos", label: "Términos y condiciones", layout: "legal" },
  contacto: { slug: "contacto", path: "/contacto", label: "Contacto (introducción)", layout: "info", note: "Debajo van el formulario y los canales (email, teléfono, horario) de la configuración." },
};

export const isContentSlug = (value: string): value is ContentSlug => (CONTENT_SLUGS as readonly string[]).includes(value);
