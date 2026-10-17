"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

/** True when `pathname` is `href` or lives under it ("/" only matches itself). */
function isCurrentPath(pathname: string, href: string) {
  const path = href.split(/[?#]/)[0];
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

interface NavLinkProps extends ComponentProps<typeof Link> {
  href: string;
  /** Links with a query (theme searches) never mark themselves current. */
  matchPath?: boolean;
}

/**
 * Next link that sets aria-current="page" on its own route, so a Server
 * Component nav can style the active item with `aria-[current=page]:`.
 */
export function NavLink({ href, matchPath = true, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const current = matchPath && isCurrentPath(pathname, href);
  return <Link href={href} aria-current={current ? "page" : undefined} {...props} />;
}
