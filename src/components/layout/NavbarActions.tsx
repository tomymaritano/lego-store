"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Heart, Menu, Scale, Search, ShoppingCart } from "lucide-react";
import { pluralize } from "@/lib/utils";
import { useCartCount, useCartDrawerOpen, useCompareCount, useUiStore, useWishlistCount } from "@/stores";
import { IconButton, ThemeToggle } from "@/components/ui";
import type { NavItem } from "@/config/navigation";
import { AccountMenu, type NavAccount } from "./AccountMenu";
import { CountIcon } from "./CountBadge";

// The three panels load on demand: they are on every page but rarely opened,
// so their code (Base UI dialog, cart lines, search combobox) stays out of the
// first-load bundle. Each trigger preloads its panel on hover/focus/press, and
// a panel stays mounted after its first open so it can animate out. The cart
// drawer also preloads when the browser is idle once the cart has something in
// it, because a card's "Ver carrito" button opens it without touching the
// navbar trigger (no dead time before the first slide-in).
const loadCartDrawer = () => import("@/components/cart/CartDrawer");
const loadMobileMenu = () => import("./MobileMenu");
const loadMobileSearch = () => import("./MobileSearch");
const CartDrawer = dynamic(() => loadCartDrawer().then((mod) => mod.CartDrawer), { ssr: false });
const MobileMenu = dynamic(() => loadMobileMenu().then((mod) => mod.MobileMenu), { ssr: false });
const MobileSearch = dynamic(() => loadMobileSearch().then((mod) => mod.MobileSearch), { ssr: false });

const preload = (load: () => Promise<unknown>) => ({
  onPointerEnter: () => void load(),
  onFocus: () => void load(),
  onPointerDown: () => void load(),
});

/** Runs `load` once the main thread is idle (setTimeout where requestIdleCallback is missing). */
function whenIdle(load: () => unknown) {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(() => void load(), { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(() => void load(), 200);
  return () => window.clearTimeout(id);
}

/** True from the first time `open` is true (lazy panels mount once, then stay). */
function useOpenedOnce(open: boolean) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened || open;
}

const withCount = (name: string, count: number) => (count > 0 ? `${name}, ${pluralize(count, "producto")}` : name);

export interface NavbarActionsProps {
  links: NavItem[];
  themes: NavItem[];
  /** The signed-in user (null for visitors), read on the server. */
  account: NavAccount | null;
  logoutAction: () => Promise<void>;
}

/**
 * Right side of the Navbar (client island): search trigger (phones), theme,
 * account (login link or account menu; on phones it lives in the mobile
 * menu), compare / wishlist / cart with live counts, the menu trigger and the
 * panels they open (full-screen search, mobile menu, cart drawer).
 */
export function NavbarActions({ links, themes, account, logoutAction }: NavbarActionsProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // Logging out from inside the mobile menu re-renders it signed out: close it instead of leaving it open.
  const accountKey = account?.email ?? null;
  const [menuAccountKey, setMenuAccountKey] = useState(accountKey);
  if (menuAccountKey !== accountKey) {
    setMenuAccountKey(accountKey);
    setIsMenuOpen(false);
  }
  const isCartOpen = useCartDrawerOpen();
  const setIsCartOpen = useUiStore((state) => state.setCartDrawerOpen);

  const searchMounted = useOpenedOnce(isSearchOpen);
  const menuMounted = useOpenedOnce(isMenuOpen);
  const cartMounted = useOpenedOnce(isCartOpen);

  const cartCount = useCartCount();
  const wishlistCount = useWishlistCount();
  const compareCount = useCompareCount();

  const hasCartItems = cartCount > 0;
  useEffect(() => (hasCartItems ? whenIdle(loadCartDrawer) : undefined), [hasCartItems]);

  return (
    <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
      <IconButton
        label="Buscar"
        className="md:hidden"
        onClick={() => setIsSearchOpen(true)}
        aria-haspopup="dialog"
        {...preload(loadMobileSearch)}
      >
        <Search aria-hidden="true" />
      </IconButton>

      <ThemeToggle className="hidden sm:inline-flex" />

      <AccountMenu account={account} logoutAction={logoutAction} className="hidden sm:flex" />

      <IconButton
        label={withCount("Comparar", compareCount)}
        className="hidden sm:inline-flex"
        render={<Link href="/compare" />}
        data-testid="compare-button"
      >
        <CountIcon
          icon={<Scale aria-hidden="true" className="size-5" />}
          count={compareCount}
          testId="compare-count"
          tone="info"
        />
      </IconButton>

      <IconButton
        label={withCount("Favoritos", wishlistCount)}
        render={<Link href="/wishlist" />}
        data-testid="wishlist-button"
      >
        <CountIcon
          icon={<Heart aria-hidden="true" className="size-5" />}
          count={wishlistCount}
          testId="wishlist-count"
          tone="sale"
        />
      </IconButton>

      <IconButton
        label={withCount("Carrito", cartCount)}
        aria-haspopup="dialog"
        onClick={() => setIsCartOpen(true)}
        data-testid="cart-button"
        {...preload(loadCartDrawer)}
      >
        <CountIcon
          icon={<ShoppingCart aria-hidden="true" className="size-5" />}
          count={cartCount}
          testId="cart-count"
        />
      </IconButton>

      <IconButton
        label="Abrir menú"
        className="lg:hidden"
        aria-haspopup="dialog"
        onClick={() => setIsMenuOpen(true)}
        {...preload(loadMobileMenu)}
      >
        <Menu aria-hidden="true" />
      </IconButton>

      {searchMounted ? <MobileSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} /> : null}
      {menuMounted ? (
        <MobileMenu
          open={isMenuOpen}
          onOpenChange={setIsMenuOpen}
          links={links}
          themes={themes}
          counts={{ cart: cartCount, wishlist: wishlistCount, compare: compareCount }}
          account={account}
          logoutAction={logoutAction}
          onOpenCart={() => setIsCartOpen(true)}
        />
      ) : null}
      {cartMounted ? <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} /> : null}
    </div>
  );
}
