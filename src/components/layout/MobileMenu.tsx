"use client";

import type { ReactNode } from "react";
import { m } from "motion/react";
import { usePathname } from "next/navigation";
import { Heart, LayoutDashboard, LogIn, LogOut, Scale, ShoppingCart, UserPlus, UserRound } from "lucide-react";
import { STAGGER, STAGGER_DELAY, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { helpLinks, type NavItem } from "@/config/navigation";
import { loginHref } from "@/lib/auth/callback-url";
import {
  Button,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  ThemeToggle,
} from "@/components/ui";
import { NavLink } from "./NavLink";
import { accountInitial, type NavAccount } from "./AccountMenu";

interface MobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  links: NavItem[];
  themes: NavItem[];
  counts: { cart: number; wishlist: number; compare: number };
  onOpenCart: () => void;
  account: NavAccount | null;
  logoutAction: () => Promise<void>;
}

const itemClasses =
  "flex items-center gap-3 rounded-xl px-4 py-3 font-medium text-fg-secondary transition-colors duration-fast ease-standard hover:bg-bg-muted hover:text-fg aria-[current=page]:bg-primary/15 aria-[current=page]:text-fg";

function Group({ title, children, columns = 1 }: { title: string; children: ReactNode; columns?: 1 | 2 }) {
  return (
    <m.section variants={staggerItem} aria-label={title}>
      <h2 className="mb-2 px-4 text-caption font-semibold tracking-wider text-fg-muted uppercase">{title}</h2>
      <ul className={columns === 2 ? "grid grid-cols-2 gap-0.5" : "space-y-0.5"}>{children}</ul>
    </m.section>
  );
}

function Count({ value }: { value: number }) {
  if (value === 0) return null;
  return (
    <span className="ml-auto rounded-full bg-bg-muted px-2 py-0.5 text-caption font-bold text-fg tabular-nums">
      {value}
    </span>
  );
}

/** Phone/tablet navigation in a left Sheet: account, categories, themes, saved items and help. */
export function MobileMenu({ open, onOpenChange, links, themes, counts, onOpenCart, account, logoutAction }: MobileMenuProps) {
  const close = () => onOpenChange(false);
  const pathname = usePathname() ?? "/";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" closeLabel="Cerrar menú" className="max-w-xs sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Menú</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <m.nav
            aria-label="Menú móvil"
            variants={staggerContainer(STAGGER, STAGGER_DELAY.short)}
            initial="hidden"
            animate="visible"
            className="space-y-6 px-2 py-4"
          >
            <Group title="Tu cuenta">
              {account ? (
                <>
                  <li className="flex items-center gap-3 px-4 py-2">
                    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-on-primary">
                      {accountInitial(account)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-fg">{account.name?.trim() || account.email}</span>
                      {account.name ? <span className="block truncate text-caption text-fg-muted">{account.email}</span> : null}
                    </span>
                  </li>
                  <li>
                    <NavLink href="/account" onClick={close} className={itemClasses}>
                      <UserRound aria-hidden="true" className="size-5" />
                      Mi cuenta
                    </NavLink>
                  </li>
                  {account.role === "ADMIN" ? (
                    <li>
                      <NavLink href="/admin" onClick={close} className={itemClasses}>
                        <LayoutDashboard aria-hidden="true" className="size-5" />
                        Administración
                      </NavLink>
                    </li>
                  ) : null}
                  <li>
                    <form action={logoutAction}>
                      <Button type="submit" variant="ghost" className={cn(itemClasses, "h-auto w-full justify-start text-body")}>
                        <LogOut aria-hidden="true" className="size-5" />
                        Cerrar sesión
                      </Button>
                    </form>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <NavLink href={loginHref(pathname)} matchPath={false} onClick={close} className={itemClasses}>
                      <LogIn aria-hidden="true" className="size-5" />
                      Iniciar sesión
                    </NavLink>
                  </li>
                  <li>
                    <NavLink href={loginHref(pathname, "/register")} matchPath={false} onClick={close} className={itemClasses}>
                      <UserPlus aria-hidden="true" className="size-5" />
                      Crear cuenta
                    </NavLink>
                  </li>
                </>
              )}
            </Group>

            <Group title="Categorías" columns={2}>
              {links.map((item) => (
                <li key={item.href}>
                  <NavLink href={item.href} onClick={close} className={itemClasses}>
                    {item.name}
                  </NavLink>
                </li>
              ))}
            </Group>

            <Group title="Temas" columns={2}>
              {themes.map((item) => (
                <li key={item.href}>
                  <NavLink href={item.href} matchPath={false} onClick={close} className={itemClasses}>
                    {item.name}
                  </NavLink>
                </li>
              ))}
            </Group>

            <Group title="Tus productos">
              <li>
                <NavLink href="/wishlist" onClick={close} className={itemClasses}>
                  <Heart aria-hidden="true" className="size-5" />
                  Favoritos
                  <Count value={counts.wishlist} />
                </NavLink>
              </li>
              <li>
                <NavLink href="/compare" onClick={close} className={itemClasses}>
                  <Scale aria-hidden="true" className="size-5" />
                  Comparar
                  <Count value={counts.compare} />
                </NavLink>
              </li>
              <li>
                <Button
                  variant="ghost"
                  className={cn(itemClasses, "h-auto w-full justify-start text-body")}
                  onClick={() => {
                    close();
                    onOpenCart();
                  }}
                >
                  <ShoppingCart aria-hidden="true" className="size-5" />
                  Carrito
                  <Count value={counts.cart} />
                </Button>
              </li>
            </Group>

            <Group title="Ayuda">
              {helpLinks.map((item) => (
                <li key={item.href}>
                  <NavLink href={item.href} onClick={close} className={itemClasses}>
                    {item.name}
                  </NavLink>
                </li>
              ))}
            </Group>
          </m.nav>
        </SheetBody>
        <SheetFooter className="flex-row items-center justify-between">
          <span className="text-label font-medium text-fg-secondary">Tema</span>
          <ThemeToggle showLabel />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
