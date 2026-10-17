"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { LayoutDashboard, LogOut, User, UserRound } from "lucide-react";
import { dropDown } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { loginHref } from "@/lib/auth/callback-url";
import { IconButton } from "@/components/ui";

/** What the navbar knows about the signed-in user (rendered on the server, so there is no flash). */
export interface NavAccount {
  name: string | null;
  email: string;
  role: "USER" | "ADMIN";
}

export interface AccountMenuProps {
  account: NavAccount | null;
  /** Logout Server Action, passed down from the server Navbar. */
  logoutAction: () => Promise<void>;
  className?: string;
}

const itemClasses =
  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-label font-medium text-fg-secondary transition-colors duration-fast ease-standard hover:bg-bg-muted hover:text-fg focus-visible:bg-bg-muted focus-visible:text-fg [&_svg]:size-4";

/** First letter of the name (or email), shown in the trigger once signed in. */
export function accountInitial(account: NavAccount): string {
  return (account.name?.trim() || account.email).charAt(0).toLocaleUpperCase("es-AR");
}

/**
 * Account control in the navbar. Signed out: a link to /login that returns
 * to the current page. Signed in: a disclosure (button + list of links, like
 * the "Temas" menu) with the account, admin panel for admins, and logout.
 */
export function AccountMenu({ account, logoutAction, className }: AccountMenuProps) {
  const pathname = usePathname();
  const panelId = useId();
  const [open, setOpen] = useState(false);

  if (!account) {
    return (
      <IconButton label="Iniciar sesión" className={className} render={<Link href={loginHref(pathname ?? "/")} />} data-testid="login-link">
        <User aria-hidden="true" />
      </IconButton>
    );
  }

  const name = account.name?.trim() || account.email;
  return (
    <div
      className={cn("relative", className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus();
        }
      }}
    >
      <IconButton
        label={`Tu cuenta (${name})`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        data-testid="account-menu"
      >
        <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-primary text-label font-bold text-on-primary">
          {accountInitial(account)}
        </span>
      </IconButton>

      <AnimatePresence>
        {open && (
          <m.div
            id={panelId}
            variants={dropDown}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute top-full right-0 z-50 mt-1 w-64 rounded-xl border border-border bg-surface-raised p-1.5 shadow-xl"
          >
            <div className="border-b border-border px-3 pt-1.5 pb-2.5">
              <p className="truncate font-semibold text-fg">{name}</p>
              {account.name ? <p className="truncate text-caption text-fg-muted">{account.email}</p> : null}
            </div>
            {/* No prefetch: these pages are per-user, and a prefetch racing logout must not matter (proxy.ts). */}
            <ul className="space-y-0.5 py-1.5">
              <li>
                <Link href="/account" prefetch={false} onClick={() => setOpen(false)} className={itemClasses}>
                  <UserRound aria-hidden="true" />
                  Mi cuenta
                </Link>
              </li>
              {account.role === "ADMIN" ? (
                <li>
                  <Link href="/admin" prefetch={false} onClick={() => setOpen(false)} className={itemClasses}>
                    <LayoutDashboard aria-hidden="true" />
                    Administración
                  </Link>
                </li>
              ) : null}
            </ul>
            <form action={logoutAction} className="border-t border-border pt-1.5">
              <button type="submit" className={itemClasses}>
                <LogOut aria-hidden="true" />
                Cerrar sesión
              </button>
            </form>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
