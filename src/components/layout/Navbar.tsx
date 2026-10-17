import Link from "next/link";
import Image from "next/image";
import { Truck } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { themeLinks, type NavItem } from "@/config/navigation";
import { SearchAutocomplete } from "@/components/search";
import type { Category } from "@/types";
import { NavLink } from "./NavLink";
import { NavbarActions } from "./NavbarActions";
import { ThemesMenu } from "./ThemesMenu";

/** Categories shown inline on desktop; the mobile menu lists all of them. */
const DESKTOP_CATEGORIES = 3;

const navLinkClasses =
  "inline-flex h-10 items-center rounded-lg px-3 font-medium text-fg-secondary transition-colors duration-fast ease-standard hover:bg-bg-muted hover:text-fg aria-[current=page]:bg-bg-muted aria-[current=page]:text-fg";

/**
 * Site header. Server Component: the promo strip, logo and links render on
 * the server; NavLink (aria-current), ThemesMenu, SearchAutocomplete and
 * NavbarActions (counts, drawers, menus) are the client islands.
 */
export function Navbar({ categories }: { categories: Pick<Category, "id" | "name">[] }) {
  const links: NavItem[] = [
    { name: "Todos", href: "/" },
    ...categories.map((c) => ({ name: c.name, href: `/category/${c.id}` })),
  ];

  return (
    <>
      <aside aria-label="Promoción" className="bg-brand-red text-on-brand-red">
        <p className="container-custom flex flex-wrap items-center justify-center gap-x-2 py-2 text-center text-label font-medium">
          <Truck aria-hidden="true" className="size-4 shrink-0" />
          <span>Envío gratis en compras desde {formatPrice(siteConfig.commerce.freeShippingThreshold)}</span>
          <Link
            href="/envios"
            className="rounded-sm font-semibold underline underline-offset-2 hover:no-underline focus-visible:outline-on-brand-red"
          >
            Ver condiciones
          </Link>
        </p>
      </aside>

      <header data-site-header className="sticky top-0 z-40 border-b border-border bg-surface/90 shadow-sm backdrop-blur-md">
        <div className="container-custom flex h-header items-center gap-2 lg:gap-4">
          <Link href="/" className="shrink-0 rounded-lg transition-[scale] duration-fast ease-standard hover:scale-105 motion-reduce:hover:scale-100">
            <Image src="/images/lego.png" alt={`${siteConfig.name}, inicio`} width={40} height={40} className="size-10" preload />
          </Link>

          <nav aria-label="Principal" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {links.slice(0, DESKTOP_CATEGORIES + 1).map((link) => (
                <li key={link.href}>
                  <NavLink href={link.href} className={navLinkClasses}>
                    {link.name}
                  </NavLink>
                </li>
              ))}
              <li>
                <ThemesMenu themes={themeLinks} triggerClassName="h-10 px-3 text-body font-medium" />
              </li>
            </ul>
          </nav>

          <div className="hidden min-w-0 flex-1 justify-center md:flex">
            <SearchAutocomplete className="w-full max-w-md" />
          </div>

          <NavbarActions links={links} themes={themeLinks} />
        </div>
      </header>
    </>
  );
}
