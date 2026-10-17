"use client";

import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./IconButton";
import { overlayClasses } from "./Dialog";

/*
 * Sheet (side drawer): a Base UI Dialog that slides in from an edge.
 * Same accessibility contract as Dialog (focus trap, Escape, focus return,
 * role="dialog" labelled by SheetTitle).
 */

const Sheet = BaseDialog.Root;
const SheetTrigger = BaseDialog.Trigger;
const SheetClose = BaseDialog.Close;

type WithClassName<T> = Omit<T, "className"> & { className?: string };

const sheetVariants = cva(
  [
    "fixed z-50 flex flex-col bg-surface text-fg shadow-xl outline-none",
    "transition-[translate,opacity] duration-slow ease-emphasized data-ending-style:duration-base data-ending-style:ease-exit",
  ],
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 h-dvh w-full max-w-md border-l border-border data-starting-style:translate-x-full data-ending-style:translate-x-full",
        left: "inset-y-0 left-0 h-dvh w-full max-w-md border-r border-border data-starting-style:-translate-x-full data-ending-style:-translate-x-full",
        top: "inset-x-0 top-0 max-h-dvh border-b border-border data-starting-style:-translate-y-full data-ending-style:-translate-y-full",
        bottom:
          "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t border-border data-starting-style:translate-y-full data-ending-style:translate-y-full",
      },
    },
    defaultVariants: { side: "right" },
  }
);

export interface SheetContentProps extends WithClassName<React.ComponentProps<typeof BaseDialog.Popup>> {
  side?: "left" | "right" | "top" | "bottom";
  showCloseButton?: boolean;
  closeLabel?: string;
}

function SheetContent({ className, children, side = "right", showCloseButton = true, closeLabel = "Cerrar", ...props }: SheetContentProps) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop data-slot="sheet-overlay" className={overlayClasses} />
      <BaseDialog.Popup data-slot="sheet-content" data-side={side} className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        {showCloseButton ? (
          <BaseDialog.Close render={<IconButton label={closeLabel} size="icon-sm" variant="ghost" className="absolute top-3.5 right-3" />}>
            <X aria-hidden="true" />
          </BaseDialog.Close>
        ) : null}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1 border-b border-border px-4 py-4 pr-14", className)} {...props} />;
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-body" className={cn("min-h-0 flex-1 overflow-y-auto", className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 border-t border-border p-4", className)} {...props} />;
}

function SheetTitle({ className, ...props }: WithClassName<React.ComponentProps<typeof BaseDialog.Title>>) {
  return <BaseDialog.Title data-slot="sheet-title" className={cn("text-title text-fg", className)} {...props} />;
}

function SheetDescription({ className, ...props }: WithClassName<React.ComponentProps<typeof BaseDialog.Description>>) {
  return <BaseDialog.Description data-slot="sheet-description" className={cn("text-sm text-fg-muted", className)} {...props} />;
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle, SheetDescription };
