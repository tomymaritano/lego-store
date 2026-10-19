import Link from "next/link";
import Image from "next/image";
import { siteConfig } from "@/config/site";
import { logoutAction } from "@/lib/auth/actions";
import type { NavItem } from "@/config/navigation";
import type { StoreSettings } from "@/lib/settings/defaults";
import { SearchAutocomplete } from "@/components/search";
import type { Category } from "@/types";
import { AnnouncementBar } from "./AnnouncementBar";
import { NavLink } from "./NavLink";
import type { NavAccount } from "./AccountMenu";
import { NavbarActions } from "./NavbarActions";
import { ThemesMenu } from "./ThemesMenu";

/** Categories shown inline on desktop; the mobile menu lists all of them. */
const DESKTOP_CATEGORIES = 3;

const navLinkClasses =
  "inline-flex h-10 items-center rounded-lg px-3 font-medium text-fg-secondary transition-colors duration-fast ease-standard hover:bg-bg-muted hover:text-fg aria-[current=page]:bg-bg-muted aria-[current=page]:text-fg";

/**
 * Site header. Server Component: the announcement bar (the admin's, from the
 * store's settings), logo and links render on
 * the server; NavLink (aria-current), ThemesMenu, SearchAutocomplete and
 * NavbarActions (counts, drawers, menus, account) are the client islands.
 * The root layout reads the session and passes `account`, so the signed-in
 * state is in the server HTML (no flash after hydration).
 */
export function Navbar({
  categories,
  themes,
  account,
  settings = null,
}: {
  categories: Pick<Category, "id" | "name">[];
  /** The "Temas" menu (config/navigation.ts themeNavItems). */
  themes: NavItem[];
  account: NavAccount | null;
  /** The store's settings (the announcement bar); null leaves the bar out (Storybook). */
  settings?: StoreSettings | null;
}) {
  const links: NavItem[] = [
    { name: "Todos", href: "/" },
    ...categories.map((c) => ({ name: c.name, href: `/category/${c.id}` })),
  ];

  return (
    <>
      {settings ? <AnnouncementBar announcement={settings.announcement} settings={settings} /> : null}

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
                {themes.length > 0 ? <ThemesMenu themes={themes} triggerClassName="h-10 px-3 text-body font-medium" /> : null}
              </li>
            </ul>
          </nav>

          <div className="hidden min-w-0 flex-1 justify-center md:flex">
            <SearchAutocomplete className="w-full max-w-md" />
          </div>

          <NavbarActions links={links} themes={themes} account={account} logoutAction={logoutAction} />
        </div>
      </header>
    </>
  );
}
