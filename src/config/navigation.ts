/**
 * Static navigation shared by the shell (Navbar, mobile menu, Footer) and the
 * info pages. Every internal href here must resolve to a page:
 * __tests__/config/navigation.test.ts fails on a dead link.
 */

export interface NavItem {
  name: string;
  href: string;
}

/** Themes link to a search, which matches the theme name (same algorithm as /search). */
export const themeLinks: NavItem[] = ["Star Wars", "Marvel", "Disney", "Harry Potter"].map((name) => ({
  name,
  href: `/search?q=${encodeURIComponent(name)}`,
}));

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
