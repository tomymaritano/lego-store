"use client";

import { Toaster as SonnerToaster, toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Info, ShoppingCart, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const PHONE_QUERY = "(max-width: 639px)";

/**
 * Sonner, themed with design tokens (no richColors: our tokens carry contrast).
 * `unstyled` drops Sonner's rule that hides the content of collapsed back
 * toasts; globals.css restores it (see "Sonner: unstyled toasts").
 */
export function Toaster() {
  // Phones: toasts drop from the top so they never sit over the docked
  // compare bar or a sheet's footer CTAs at the bottom of the screen.
  const isPhone = useMediaQuery(PHONE_QUERY);
  return (
    <SonnerToaster
      position={isPhone ? "top-center" : "bottom-right"}
      duration={3000}
      containerAriaLabel="Notificaciones"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 overflow-hidden rounded-xl border border-border bg-surface-raised p-4 text-fg shadow-xl",
          title: "text-sm font-semibold",
          description: "text-caption text-fg-muted",
          icon: "shrink-0",
          actionButton: "rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary",
          cancelButton: "rounded-lg bg-bg-muted px-3 py-1.5 text-sm font-semibold text-fg",
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
  wishlist: (message: string, added: boolean) => {
    toast.success(message, {
      icon: (
        <Heart aria-hidden="true" className={cn(iconClass, added ? "fill-sale text-sale" : "text-fg-muted")} />
      ),
    });
  },
};

export { toast };
