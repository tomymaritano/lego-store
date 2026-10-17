"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, ShoppingCart, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

type Sonner = typeof import("sonner");

/**
 * Toasts load lazily: Sonner (and its viewport) stays out of every route's
 * first-load JS. `<Toaster />` mounts the viewport client-side right after
 * hydration, and `showToast.*` waits for both Sonner and a mounted viewport,
 * so a toast fired early is never lost.
 */
let sonner: Sonner | undefined;
let sonnerPromise: Promise<Sonner> | undefined;
const loadSonner = () =>
  (sonnerPromise ??= import("sonner").then((mod) => {
    sonner = mod;
    return mod;
  }));

let markViewportReady: () => void = () => {};
const viewportReady = new Promise<void>((resolve) => {
  markViewportReady = resolve;
});
const onViewportReady = () => markViewportReady();

const ToastViewport = dynamic(() => import("./ToastViewport").then((mod) => mod.ToastViewport), { ssr: false });

export function Toaster() {
  return <ToastViewport onReady={onViewportReady} />;
}

type Toast = Sonner["toast"];

function show(fire: (toast: Toast) => void) {
  void Promise.all([loadSonner(), viewportReady]).then(([mod]) => fire(mod.toast));
}

/**
 * Sonner's toast API for the rare direct call. `dismiss()` is synchronous
 * (nothing to dismiss before Sonner has loaded).
 */
export const toast = {
  dismiss: (id?: string | number) => {
    sonner?.toast.dismiss(id);
  },
};

const iconClass = "size-5";

export const showToast = {
  success: (message: string) => {
    show((toast) => toast.success(message, { icon: <CheckCircle2 aria-hidden="true" className={cn(iconClass, "text-success")} /> }));
  },
  error: (message: string) => {
    show((toast) => toast.error(message, { icon: <XCircle aria-hidden="true" className={cn(iconClass, "text-danger")} /> }));
  },
  warning: (message: string) => {
    show((toast) =>
      toast.warning(message, { icon: <AlertTriangle aria-hidden="true" className={cn(iconClass, "text-warning")} /> })
    );
  },
  info: (message: string) => {
    show((toast) => toast.info(message, { icon: <Info aria-hidden="true" className={cn(iconClass, "text-info")} /> }));
  },
  cart: (message: string) => {
    show((toast) =>
      toast.success(message, {
        icon: (
          <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-primary text-on-primary">
            <ShoppingCart className="size-4" />
          </span>
        ),
      })
    );
  },
  /**
   * Confirms a removal with a "Deshacer" action. Stays longer than the
   * default (and Sonner pauses it on hover/focus) so there is time to undo.
   */
  undo: (
    message: string,
    onUndo: () => void,
    { icon = <Info aria-hidden="true" className={cn(iconClass, "text-info")} /> }: { icon?: ReactNode } = {}
  ) => {
    show((toast) =>
      toast(message, {
        icon,
        duration: 6000,
        action: { label: "Deshacer", onClick: onUndo },
      })
    );
  },
  wishlist: (message: string, added: boolean) => {
    show((toast) =>
      toast.success(message, {
        icon: <Heart aria-hidden="true" className={cn(iconClass, added ? "fill-sale text-sale" : "text-fg-muted")} />,
      })
    );
  },
};
