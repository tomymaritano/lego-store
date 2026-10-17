"use client";

import { useId, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Heart, Menu, Search, ShoppingCart, User } from "lucide-react";
import { collapse, dropDown, transitions } from "@/lib/motion";
import { cn, formatPrice } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { useCartCount, useWishlistCount } from "@/stores";
import {
  Button,
  IconButton,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  ThemeToggle,
  showToast,
} from "@/components/ui";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SearchAutocomplete } from "@/components/search";
import type { Category } from "@/types";

/** Themes link to a search, which matches the theme name. */
const themes = ["Star Wars", "Marvel", "Disney", "Harry Potter"].map((name) => ({
  name,
  href: `/search?q=${encodeURIComponent(name)}`,
}));

/** Categories shown inline on desktop; the mobile menu lists all of them. */
const DESKTOP_CATEGORIES = 3;

const navLinkClasses =
  "rounded-lg px-3 py-2 font-medium text-fg-secondary transition-colors duration-fast hover:bg-bg-muted hover:text-fg";

/** Count bubble on an icon button; pops when the number changes. */
function CountBadge({ count, testId, tone }: { count: number; testId: string; tone: "primary" | "sale" }) {
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.span
          key={count}
          aria-hidden="true"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={transitions.spring}
          className={cn(
            "absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-caption leading-none font-bold tabular-nums ring-2 ring-surface",
            tone === "primary" ? "bg-primary text-on-primary" : "bg-sale text-on-sale"
          )}
          data-testid={testId}
        >
          {count}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export function Navbar({ categories }: { categories: Pick<Category, "id" | "name">[] }) {
  const pathname = usePathname();
  const themesMenuId = useId();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showThemes, setShowThemes] = useState(false);

  const cartCount = useCartCount();
  const wishlistCount = useWishlistCount();

  const links = [{ name: "Todos", href: "/" }, ...categories.map((c) => ({ name: c.name, href: `/category/${c.id}` }))];
  const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <p className="bg-sale py-2 text-center text-sm font-medium text-on-sale">
        Envío gratis en compras desde {formatPrice(siteConfig.commerce.freeShippingThreshold)}
      </p>

      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 shadow-sm backdrop-blur-sm">
        <nav aria-label="Navegación principal" className="container-custom">
          <div className="flex h-16 items-center justify-between gap-2">
            <Link href="/" className="shrink-0 rounded-lg">
              <Image src="/images/lego.png" alt={`${siteConfig.name}, inicio`} width={80} height={40} className="h-10 w-auto" preload />
            </Link>

            <ul className="hidden items-center gap-1 lg:flex">
              {links.slice(0, DESKTOP_CATEGORIES + 1).map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isCurrent(link.href) ? "page" : undefined}
                    className={cn(navLinkClasses, isCurrent(link.href) && "bg-bg-muted text-fg")}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}

              <li
                className="relative"
                onMouseEnter={() => setShowThemes(true)}
                onMouseLeave={() => setShowThemes(false)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setShowThemes(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setShowThemes(false);
                }}
              >
                <Button
                  variant="ghost"
                  className="px-3"
                  aria-expanded={showThemes}
                  aria-controls={themesMenuId}
                  onClick={() => setShowThemes((open) => !open)}
                >
                  Temas
                  <ChevronDown
                    aria-hidden="true"
                    className={cn("transition-[rotate] duration-fast ease-standard", showThemes && "rotate-180")}
                  />
                </Button>

                <AnimatePresence>
                  {showThemes && (
                    <motion.ul
                      id={themesMenuId}
                      variants={dropDown}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="absolute top-full left-0 z-50 mt-1 w-48 rounded-xl border border-border bg-surface-raised py-2 shadow-xl"
                    >
                      {themes.map((theme) => (
                        <li key={theme.name}>
                          <Link
                            href={theme.href}
                            onClick={() => setShowThemes(false)}
                            className="block px-4 py-2 text-sm text-fg-secondary hover:bg-bg-muted hover:text-fg focus-visible:bg-bg-muted focus-visible:text-fg"
                          >
                            {theme.name}
                          </Link>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </li>
            </ul>

            <div className="mx-4 hidden max-w-md flex-1 md:block">
              <SearchAutocomplete />
            </div>

            <div className="flex items-center gap-1">
              <IconButton
                label={isSearchOpen ? "Cerrar búsqueda" : "Buscar"}
                aria-expanded={isSearchOpen}
                className="md:hidden"
                onClick={() => setIsSearchOpen((open) => !open)}
              >
                <Search aria-hidden="true" />
              </IconButton>

              <ThemeToggle />

              <IconButton
                label="Mi cuenta"
                className="hidden sm:inline-flex"
                onClick={() => showToast.info("Muy pronto podrás crear tu cuenta")}
              >
                <User aria-hidden="true" />
              </IconButton>

              <IconButton
                label={wishlistCount > 0 ? `Favoritos (${wishlistCount})` : "Favoritos"}
                className="relative overflow-visible"
                render={<Link href="/wishlist" />}
                data-testid="wishlist-button"
              >
                <Heart aria-hidden="true" />
                <CountBadge count={wishlistCount} testId="wishlist-count" tone="sale" />
              </IconButton>

              <IconButton
                label={cartCount > 0 ? `Carrito (${cartCount} productos)` : "Carrito"}
                className="relative overflow-visible"
                onClick={() => setIsCartOpen(true)}
                data-testid="cart-button"
              >
                <motion.span
                  key={cartCount}
                  className="flex"
                  // Remounts when the count changes: a short bump as add-to-cart feedback.
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.25, 1] }}
                  transition={transitions.slow}
                >
                  <ShoppingCart aria-hidden="true" />
                </motion.span>
                <CountBadge count={cartCount} testId="cart-count" tone="primary" />
              </IconButton>

              <IconButton label="Abrir menú" className="lg:hidden" onClick={() => setIsMobileMenuOpen(true)}>
                <Menu aria-hidden="true" />
              </IconButton>
            </div>
          </div>

          <AnimatePresence>
            {isSearchOpen && (
              <motion.div variants={collapse} initial="hidden" animate="visible" exit="exit" className="overflow-hidden md:hidden">
                <div className="pb-4">
                  <SearchAutocomplete autoFocus onClose={() => setIsSearchOpen(false)} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
      </header>

      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Menú</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <nav aria-label="Menú móvil" className="space-y-6 p-4">
              {[
                { title: "Categorías", items: links },
                { title: "Temas", items: themes },
              ].map((group) => (
                <section key={group.title} aria-label={group.title}>
                  <p className="mb-3 text-caption font-semibold tracking-wider text-fg-muted uppercase">{group.title}</p>
                  <ul className="space-y-1">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          aria-current={isCurrent(item.href) ? "page" : undefined}
                          className="block rounded-xl px-4 py-3 font-medium text-fg-secondary transition-colors duration-fast hover:bg-bg-muted hover:text-fg aria-[current=page]:bg-bg-muted aria-[current=page]:text-fg"
                        >
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </nav>
          </SheetBody>
        </SheetContent>
      </Sheet>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
