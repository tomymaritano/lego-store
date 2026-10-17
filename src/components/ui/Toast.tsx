"use client";

import { useEffect, type ReactNode } from "react";
import { Toaster as SonnerToaster, toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Info, ShoppingCart, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
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
 */
export function Toaster() {
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
          title: "text-sm font-semibold break-words",
          description: "text-caption text-fg-muted",
          icon: "shrink-0",
          actionButton: "shrink-0 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary",
          cancelButton: "shrink-0 whitespace-nowrap rounded-lg bg-bg-muted px-3 py-1.5 text-sm font-semibold text-fg",
          closeButton: "border border-border bg-surface text-fg",
        },
      }}
    />
  );
}

const iconClass = "size-5";

export const showToast = {
  success: (message: string) => {
    toast.success(message, { icon: <CheckCircle2 aria-hidden="true" className={cn(iconClass, "text-success")} /> });
  },
  error: (message: string) => {
    toast.error(message, { icon: <XCircle aria-hidden="true" className={cn(iconClass, "text-danger")} /> });
  },
  warning: (message: string) => {
    toast.warning(message, { icon: <AlertTriangle aria-hidden="true" className={cn(iconClass, "text-warning")} /> });
  },
  info: (message: string) => {
    toast.info(message, { icon: <Info aria-hidden="true" className={cn(iconClass, "text-info")} /> });
  },
  cart: (message: string) => {
    toast.success(message, {
      icon: (
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-primary text-on-primary">
          <ShoppingCart className="size-4" />
        </span>
      ),
    });
  },
  /**
   * Confirms a removal with a "Deshacer" action. Stays longer than the
   * default (and Sonner pauses it on hover/focus) so there is time to undo.
   */
  undo: (message: string, onUndo: () => void, { icon = <Info aria-hidden="true" className={cn(iconClass, "text-info")} /> }: { icon?: ReactNode } = {}) => {
    toast(message, {
      icon,
      duration: 6000,
      action: { label: "Deshacer", onClick: onUndo },
    });
  },
  wishlist: (message: string, added: boolean) => {
    toast.success(message, {
      icon: (
        <Heart aria-hidden="true" className={cn(iconClass, added ? "fill-sale text-sale" : "text-fg-muted")} />
      ),
    });
  },
};

export { toast };
