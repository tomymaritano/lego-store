"use client";

import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./IconButton";

/*
 * Dialog on Base UI: role="dialog", aria-modal, labelled by DialogTitle,
 * focus trapped while open, Escape and backdrop click close it, and focus
 * returns to the element that opened it. Enter/exit use CSS transitions on
 * Base UI's data-starting-style / data-ending-style (unmount waits for them).
 */

const Dialog = BaseDialog.Root;
const DialogTrigger = BaseDialog.Trigger;
const DialogClose = BaseDialog.Close;

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export const overlayClasses = cn(
  "fixed inset-0 z-50 bg-overlay supports-backdrop-filter:backdrop-blur-xs",
  "transition-opacity duration-base ease-standard data-starting-style:opacity-0 data-ending-style:opacity-0"
);

function DialogOverlay({ className, ...props }: WithClassName<React.ComponentProps<typeof BaseDialog.Backdrop>>) {
  return <BaseDialog.Backdrop data-slot="dialog-overlay" className={cn(overlayClasses, className)} {...props} />;
}

export interface DialogContentProps extends WithClassName<React.ComponentProps<typeof BaseDialog.Popup>> {
  /** Renders the top-right close button. */
  showCloseButton?: boolean;
  closeLabel?: string;
}

function DialogContent({ className, children, showCloseButton = true, closeLabel = "Cerrar", ...props }: DialogContentProps) {
  return (
    <BaseDialog.Portal>
      <DialogOverlay />
      <BaseDialog.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto",
          "rounded-2xl border border-border bg-surface p-6 text-fg shadow-xl outline-none",
          "transition-[opacity,scale,translate] duration-base ease-emphasized",
          "data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-fast",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <BaseDialog.Close
            render={<IconButton label={closeLabel} size="icon-sm" variant="ghost" className="absolute top-3 right-3" />}
          >
            <X aria-hidden="true" />
          </BaseDialog.Close>
        ) : null}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5 pr-8", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
  );
}

function DialogTitle({ className, ...props }: WithClassName<React.ComponentProps<typeof BaseDialog.Title>>) {
  return <BaseDialog.Title data-slot="dialog-title" className={cn("text-title text-fg", className)} {...props} />;
}

function DialogDescription({ className, ...props }: WithClassName<React.ComponentProps<typeof BaseDialog.Description>>) {
  return <BaseDialog.Description data-slot="dialog-description" className={cn("text-body text-fg-muted", className)} {...props} />;
}

export { Dialog, DialogTrigger, DialogClose, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
