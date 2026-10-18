"use client";

import { useEffect, type ReactNode } from "react";
import { FormAlert } from "@/components/auth/FormAlert";

interface FlashNoticeProps {
  /** The query parameter that asked for the notice ("created" in "?created=1"). */
  param: string;
  children: ReactNode;
  className?: string;
}

/**
 * A success notice shown once, after a redirect that carried `?<param>=1`:
 * on mount the parameter leaves the URL (window.history.replaceState, which
 * Next's router follows), so the next refresh of the page (a save, an
 * archive) or a reload no longer shows it.
 */
export function FlashNotice({ param, children, className }: FlashNoticeProps) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(param)) return;
    url.searchParams.delete(param);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [param]);

  return (
    <FormAlert tone="success" className={className}>
      {children}
    </FormAlert>
  );
}
