"use client";

import { Toaster as SonnerToaster, toast } from "sonner";
import { CheckCircle, XCircle, AlertCircle, Info, ShoppingCart, Heart } from "lucide-react";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        duration: 3000,
        className: "!bg-surface !border !border-border !shadow-xl !rounded-xl !text-foreground-primary",
      }}
      expand={false}
      richColors
    />
  );
}

export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      icon: <CheckCircle className="w-5 h-5 text-green-500" />,
    });
  },
  error: (message: string) => {
    toast.error(message, {
      icon: <XCircle className="w-5 h-5 text-red-500" />,
    });
  },
  warning: (message: string) => {
    toast.warning(message, {
      icon: <AlertCircle className="w-5 h-5 text-amber-500" />,
    });
  },
  info: (message: string) => {
    toast.info(message, {
      icon: <Info className="w-5 h-5 text-blue-500" />,
    });
  },
  cart: (message: string) => {
    toast.success(message, {
      icon: <ShoppingCart className="w-5 h-5 text-lego-yellow" />,
      className: "!bg-lego-black !text-white !border-lego-yellow",
    });
  },
  wishlist: (message: string, added: boolean) => {
    toast.success(message, {
      icon: <Heart className={`w-5 h-5 ${added ? "text-lego-red fill-lego-red" : "text-gray-400"}`} />,
    });
  },
};

export { toast };
