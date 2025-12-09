"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ShoppingCart, Heart, Menu, User, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore, useWishlistStore } from "@/stores";
import { useHydration } from "@/hooks/useHydration";
import { Drawer, ThemeToggle } from "@/components/ui";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SearchAutocomplete } from "@/components/search";
import { cn } from "@/lib/utils";

const categories = [
  { name: "Todos", href: "/" },
  { name: "Helmets", href: "/category/helmet" },
  { name: "Brickheadz", href: "/category/brickheadz" },
  { name: "Vehículos", href: "/category/cars" },
];

const themes = [
  { name: "Star Wars", href: "/?theme=Star+Wars" },
  { name: "Marvel", href: "/?theme=Marvel" },
  { name: "Disney", href: "/?theme=Disney" },
  { name: "Harry Potter", href: "/?theme=Harry+Potter" },
];

export function Navbar() {
  const hydrated = useHydration();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showThemes, setShowThemes] = useState(false);

  const totalQuantity = useCartStore((state) => state.getTotalQuantity());
  const wishlistCount = useWishlistStore((state) => state.getTotalWishlistQuantity());

  return (
    <>
      {/* Promo Banner */}
      <div className="bg-lego-red text-white text-center py-2 text-sm font-medium" role="banner" aria-label="Promoción">
        <span className="hidden sm:inline" aria-hidden="true">🎁 </span>
        <span>Envío GRATIS en compras mayores a $5,000</span>
        <span className="hidden sm:inline" aria-hidden="true"> 🎁</span>
      </div>

      {/* Main Navbar */}
      <nav className="bg-surface sticky top-0 z-40 shadow-sm border-b border-border" role="navigation" aria-label="Navegación principal">
        <div className="container-custom">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0 flex items-center gap-2">
              <div className="w-10 h-10 bg-lego-yellow rounded-lg flex items-center justify-center">
                <span className="text-lego-red font-black text-lg">L</span>
              </div>
              <span className="text-xl font-black text-foreground-primary hidden sm:block">LEGO</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1" role="menubar" aria-label="Categorías">
              {categories.map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  className="px-4 py-2 rounded-lg font-medium text-foreground-secondary hover:text-foreground-primary hover:bg-background-secondary transition-colors focus-visible:ring-2 focus-visible:ring-lego-yellow focus-visible:ring-offset-2"
                  role="menuitem"
                >
                  {cat.name}
                </Link>
              ))}

              {/* Themes Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setShowThemes(true)}
                onMouseLeave={() => setShowThemes(false)}
              >
                <button
                  className="px-4 py-2 rounded-lg font-medium text-foreground-secondary hover:text-foreground-primary hover:bg-background-secondary transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-lego-yellow focus-visible:ring-offset-2"
                  aria-expanded={showThemes}
                  aria-haspopup="true"
                  aria-label="Temas, menú desplegable"
                  onFocus={() => setShowThemes(true)}
                  onBlur={() => setTimeout(() => setShowThemes(false), 150)}
                >
                  Temas
                  <ChevronDown className={cn("w-4 h-4 transition-transform", showThemes && "rotate-180")} aria-hidden="true" />
                </button>

                <AnimatePresence>
                  {showThemes && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 mt-1 w-48 bg-surface rounded-xl shadow-xl border border-border py-2 z-50"
                      role="menu"
                      aria-label="Temas disponibles"
                    >
                      {themes.map((theme) => (
                        <Link
                          key={theme.name}
                          href={theme.href}
                          className="block px-4 py-2 text-sm text-foreground-secondary hover:bg-background-secondary hover:text-lego-blue focus-visible:bg-background-secondary focus-visible:text-lego-blue focus-visible:outline-none"
                          role="menuitem"
                        >
                          {theme.name}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Search Bar - Desktop */}
            <div className="hidden md:block flex-1 max-w-md mx-6">
              <SearchAutocomplete />
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-1">
              {/* Mobile Search Toggle */}
              <button
                className="md:hidden p-2.5 rounded-full hover:bg-background-secondary transition-colors"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                aria-label="Search"
              >
                <Search className="w-5 h-5 text-foreground-secondary" />
              </button>

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* User */}
              <button className="hidden sm:flex p-2.5 rounded-full hover:bg-background-secondary transition-colors">
                <User className="w-5 h-5 text-foreground-secondary" />
              </button>

              {/* Wishlist */}
              <Link href="/wishlist" className="relative p-2.5 rounded-full hover:bg-background-secondary transition-colors">
                <Heart className="w-5 h-5 text-foreground-secondary" />
                {hydrated && wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-lego-red text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {/* Cart */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2.5 rounded-full hover:bg-background-secondary transition-colors"
                aria-label="Cart"
              >
                <ShoppingCart className="w-5 h-5 text-foreground-secondary" />
                {hydrated && totalQuantity > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-lego-yellow text-lego-black text-[10px] font-bold rounded-full flex items-center justify-center">
                    {totalQuantity}
                  </span>
                )}
              </button>

              {/* Mobile Menu Toggle */}
              <button
                className="lg:hidden p-2.5 rounded-full hover:bg-background-secondary transition-colors ml-1"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Menu"
              >
                <Menu className="w-5 h-5 text-foreground-secondary" />
              </button>
            </div>
          </div>

          {/* Mobile Search Bar */}
          <AnimatePresence>
            {isSearchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="md:hidden overflow-hidden"
              >
                <div className="pb-4">
                  <SearchAutocomplete
                    autoFocus
                    onClose={() => setIsSearchOpen(false)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      <Drawer isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} position="left" title="Menú">
        <div className="p-4">
          {/* Categories */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-3">
              Categorías
            </h3>
            <div className="space-y-1">
              {categories.map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block py-3 px-4 rounded-xl font-medium text-foreground-secondary hover:bg-background-secondary transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Themes */}
          <div>
            <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-3">
              Temas
            </h3>
            <div className="space-y-1">
              {themes.map((theme) => (
                <Link
                  key={theme.name}
                  href={theme.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block py-3 px-4 rounded-xl font-medium text-foreground-secondary hover:bg-background-secondary transition-colors"
                >
                  {theme.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Drawer>

      {/* Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
