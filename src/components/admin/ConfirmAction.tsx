"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/hooks/useHydrated";
import {
  Button,
  type ButtonProps,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  Textarea,
  showToast,
} from "@/components/ui";

export type ConfirmActionResult = { ok: true; message: string; removed?: "deleted" | "archived" } | { ok: false; error: string };

export interface ConfirmActionProps {
  /** The button that opens the dialog. */
  label: ReactNode;
  icon?: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  /** Dialog title, as a question ("¿Cancelar el pedido LEGO-001001?"). */
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Button style of the confirm button; destructive for what cannot be undone. */
  confirmVariant?: ButtonProps["variant"];
  /**
   * A Server Action bound to its arguments (`archiveProductAction.bind(null, id)`).
   * With `field`, it is called with what the admin typed there.
   */
  action: (input?: string) => Promise<ConfirmActionResult>;
  /** An optional text the dialog asks for (a block's reason), passed to `action`. */
  field?: { label: string; hint?: string; maxLength: number };
  /** Where to go after it worked (e.g. the list, once the product was deleted). */
  redirectTo?: string;
  /** Only when the action deleted the product (not when it archived it instead). */
  redirectOnlyIfDeleted?: boolean;
  testId?: string;
}

/** Navigates once mounted: keeps useRouter out of ConfirmAction itself, which also renders outside the App Router (Storybook). */
function Navigate({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.push(href);
  }, [router, href]);
  return null;
}

/**
 * A button that asks before doing something with consequences (cancel an
 * order, refund, delete): a Dialog says what will happen, the confirm button
 * runs the Server Action, and a toast reports the result. The dialog stays
 * open, with the button busy, until the server answers; Escape and "Volver"
 * close it without doing anything.
 */
export function ConfirmAction({
  label,
  icon,
  variant = "secondary",
  size = "sm",
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  action,
  redirectTo,
  redirectOnlyIfDeleted = false,
  testId,
  field,
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [navigateTo, setNavigateTo] = useState<string | null>(null);
  // Opening the dialog needs JavaScript: no dead clicks before hydration.
  const hydrated = useHydrated();

  const confirm = () =>
    startTransition(async () => {
      let result: ConfirmActionResult;
      try {
        result = await (field ? action(text) : action());
      } catch {
        result = {
          ok: false,
          error: "No pudimos completar la acción. Revisa tu conexión e inténtalo de nuevo.",
        };
      }
      if (result.ok) {
        showToast.success(result.message);
        setOpen(false);
        if (redirectTo && (!redirectOnlyIfDeleted || result.removed === "deleted")) setNavigateTo(redirectTo);
      } else {
        showToast.error(result.error);
        setOpen(false);
      }
    });

  return (
    <>
      {navigateTo ? <Navigate href={navigateTo} /> : null}
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogTrigger render={<Button variant={variant} size={size} disabled={!hydrated} data-testid={testId} />}>
          {icon}
          {label}
        </DialogTrigger>
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription render={<div />}>{description}</DialogDescription>
          </DialogHeader>
          {field ? (
            <Field label={field.label} hint={field.hint}>
              <Textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={field.maxLength} rows={3} disabled={pending} />
            </Field>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" disabled={pending} />}>Volver</DialogClose>
            <Button variant={confirmVariant} loading={pending} onClick={confirm}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
