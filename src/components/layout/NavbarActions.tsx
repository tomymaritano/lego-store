"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Menu, Scale, Search, ShoppingCart, User } from "lucide-react";
import { pluralize } from "@/lib/utils";
import { useCartCount, useCartDrawerOpen, useCompareCount, useUiStore, useWishlistCount } from "@/stores";
import { IconButton, ThemeToggle, showToast } from "@/components/ui";
import { CartDrawer } from "@/components/cart/CartDrawer";
import type { NavItem } from "@/config/navigation";
import { CountIcon } from "./CountBadge";
import { MobileMenu } from "./MobileMenu";
import { MobileSearch } from "./MobileSearch";

const withCount = (name: string, count: number) => (count > 0 ? `${name}, ${pluralize(count, "producto")}` : name);

/**
 * Right side of the Navbar (client island): search trigger (phones), theme,
 * account, compare / wishlist / cart with live counts, the menu trigger and
 * the panels they open (full-screen search, mobile menu, cart drawer).
 */
export function NavbarActions({ links, themes }: { links: NavItem[]; themes: NavItem[] }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isCartOpen = useCartDrawerOpen();
  const setIsCartOpen = useUiStore((state) => state.setCartDrawerOpen);

  const cartCount = useCartCount();
  const wishlistCount = useWishlistCount();
  const compareCount = useCompareCount();

  return (
    <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
      <IconButton label="Buscar" className="md:hidden" onClick={() => setIsSearchOpen(true)} aria-haspopup="dialog">
        <Search aria-hidden="true" />
      </IconButton>

      <ThemeToggle className="hidden sm:inline-flex" />

      <IconButton
        label="Mi cuenta"
        className="hidden sm:inline-flex"
        onClick={() => showToast.info("Muy pronto podrás crear tu cuenta")}
      >
        <User aria-hidden="true" />
      </IconButton>

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
      >
        <CountIcon
          icon={<ShoppingCart aria-hidden="true" className="size-5" />}
          count={cartCount}
          testId="cart-count"
        />
      </IconButton>

      <IconButton label="Abrir menú" className="lg:hidden" aria-haspopup="dialog" onClick={() => setIsMenuOpen(true)}>
        <Menu aria-hidden="true" />
      </IconButton>

      <MobileSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />
      <MobileMenu
        open={isMenuOpen}
        onOpenChange={setIsMenuOpen}
        links={links}
        themes={themes}
        counts={{ cart: cartCount, wishlist: wishlistCount, compare: compareCount }}
        onOpenCart={() => setIsCartOpen(true)}
      />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
