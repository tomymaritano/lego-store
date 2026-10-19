/**
 * Static navigation shared by the shell (Navbar, mobile menu, Footer) and the
 * info pages. Every internal href here must resolve to a page:
 * __tests__/config/navigation.test.ts fails on a dead link.
 */

export interface NavItem {
  name: string;
  href: string;
}

/**
 * Where a theme of the "Temas" menu goes: the catalogue filtered by it, by
 * slug (/search?theme=star-wars), the key an admin edits on purpose, so
 * renaming a theme keeps its links. The filter still accepts a theme's name
 * (?theme=Star%20Wars, older links and the filter checkboxes).
 */
export const themeHref = (slug: string) => `/search?theme=${encodeURIComponent(slug)}`;

/**
 * The "Temas" menu (navbar, mobile menu, footer): the themes an admin left
 * visible, in their order (read from the database by the root layout).
 */
export const themeNavItems = (themes: { name: string; slug: string }[]): NavItem[] =>
  themes.map((theme) => ({ name: theme.name, href: themeHref(theme.slug) }));

export const helpLinks: NavItem[] = [
  { name: "Preguntas frecuentes", href: "/faq" },
  { name: "Envíos y entregas", href: "/envios" },
  { name: "Cambios y devoluciones", href: "/devoluciones" },
  { name: "Contacto", href: "/contacto" },
];

export const companyLinks: NavItem[] = [{ name: "Sobre nosotros", href: "/nosotros" }];

export const legalLinks: NavItem[] = [
  { name: "Privacidad", href: "/privacidad" },
  { name: "Términos y condiciones", href: "/terminos" },
];

/** The info pages, grouped for their sidebar. */
export const infoNav: { title: string; items: NavItem[] }[] = [
  { title: "Ayuda", items: helpLinks },
  { title: "La tienda", items: [...companyLinks, ...legalLinks] },
];
