"use client";

import { useEffect } from "react";
import { Toaster as SonnerToaster } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const PHONE_QUERY = "(max-width: 639px)";

/**
 * Phones: toasts drop in just below the site header (the element marked
 * `data-site-header`), so they never cover its actions (cart badge, menu,
 * search). The header is sticky and has a promo bar above it until the page
 * scrolls, so its bottom edge is tracked into `--site-header-bottom`.
 */
const PHONE_TOP_OFFSET = "calc(var(--site-header-bottom, 4rem) + 0.5rem)";

function useSiteHeaderBottom(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      frame = 0;
      const header = document.querySelector("[data-site-header]");
      const bottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
      root.style.setProperty("--site-header-bottom", `${Math.round(bottom)}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      root.style.removeProperty("--site-header-bottom");
    };
  }, [enabled]);
}

/**
 * Sonner, themed with design tokens (no richColors: our tokens carry contrast).
 * `unstyled` drops Sonner's rule that hides the content of collapsed back
 * toasts; globals.css restores it (see "Sonner: unstyled toasts").
 *
 * Loaded on demand by `Toaster` in Toast.tsx (keeps Sonner out of every
 * route's first-load JS). `onReady` fires once Sonner listens for toasts.
 */
export function ToastViewport({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  // Phones: toasts drop from the top so they never sit over the docked
  // compare bar or a sheet's footer CTAs at the bottom of the screen, and
  // below the sticky header so its actions stay visible and tappable.
  const isPhone = useMediaQuery(PHONE_QUERY);
  useSiteHeaderBottom(isPhone);
  return (
    <SonnerToaster
      position={isPhone ? "top-center" : "bottom-right"}
      // Sonner switches to its mobile layout at 600px; our phone range ends at
      // 639px, so the top offset is set for both layouts.
      offset={isPhone ? { top: PHONE_TOP_OFFSET } : undefined}
      mobileOffset={{ top: PHONE_TOP_OFFSET }}
      duration={3000}
      containerAriaLabel="Notificaciones"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 overflow-hidden rounded-xl border border-border bg-surface-raised p-4 text-fg shadow-xl",
          content: "min-w-0 flex-1",
          title: "text-label break-words",
          description: "text-caption text-fg-muted",
          icon: "shrink-0",
          actionButton: "shrink-0 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-label text-on-primary",
          cancelButton: "shrink-0 whitespace-nowrap rounded-lg bg-bg-muted px-3 py-1.5 text-label text-fg",
          closeButton: "border border-border bg-surface text-fg",
        },
      }}
    />
  );
}

