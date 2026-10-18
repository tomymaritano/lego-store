/**
 * Static navigation shared by the shell (Navbar, mobile menu, Footer) and the
 * info pages. Every internal href here must resolve to a page:
 * __tests__/config/navigation.test.ts fails on a dead link.
 */

export interface NavItem {
  name: string;
  href: string;
}

/** Where a theme of the "Temas" menu goes: the catalogue filtered by it (/search?theme=Star%20Wars). */
export const themeHref = (name: string) => `/search?theme=${encodeURIComponent(name)}`;

/**
 * The "Temas" menu (navbar, mobile menu, footer): the themes an admin left
 * visible, in their order (read from the database by the root layout).
 */
export const themeNavItems = (themes: { name: string }[]): NavItem[] => themes.map((theme) => ({ name: theme.name, href: themeHref(theme.name) }));

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
