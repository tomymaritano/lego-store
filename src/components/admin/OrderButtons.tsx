"use client";

import { useEffect, useRef, useTransition } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useHydrated } from "@/hooks/useHydrated";
import { IconButton, showToast } from "@/components/ui";
import type { ConfirmActionResult } from "./ConfirmAction";

type Direction = "up" | "down";

interface OrderButtonsProps {
  /** What is moved, for the buttons' names ("Helmets"). */
  name: string;
  /** The row's place in the list, from 1. */
  position: number;
  /** How many rows the list has. */
  total: number;
  /** A Server Action bound to the row's id, taking the direction. */
  action: (direction: Direction) => Promise<ConfirmActionResult>;
}

/**
 * "Subir" / "Bajar" for a row of an ordered admin list (categories, themes):
 * the keyboard-friendly way to reorder (no dragging needed). The page
 * re-renders in the new order (rows are keyed, so this component moves with
 * its row). Focus stays on the pressed button, or goes to the other one when
 * the row reached an end, and a polite live region says the new place
 * ("Star Wars quedó en el lugar 2 de 6"). A failure is a toast.
 */
export function OrderButtons({ name, position, total, action }: OrderButtonsProps) {
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const first = position <= 1;
  const last = position >= total;
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);
  /** The direction of the move that just succeeded, until its re-render is on screen. */
  const moved = useRef<Direction | null>(null);

  useEffect(() => {
    const direction = moved.current;
    if (pending || !direction) return;
    moved.current = null;
    // The pressed button, unless the row is now at that end (it is disabled there).
    const target = direction === "up" ? (first ? downRef : upRef) : last ? upRef : downRef;
    const active = document.activeElement;
    if (active === document.body || active === upRef.current || active === downRef.current) target.current?.focus();
    if (liveRef.current) liveRef.current.textContent = `${name} quedó en el lugar ${position} de ${total}`;
  }, [pending, first, last, name, position, total]);

  const move = (direction: Direction) => {
    // aria-disabled while pending (the button keeps the focus), so a second press is ignored here.
    if (pending) return;
    if (liveRef.current) liveRef.current.textContent = "";
    startTransition(async () => {
      try {
        const result = await action(direction);
        if (result.ok) moved.current = direction;
        else showToast.error(result.error);
      } catch {
        showToast.error("No pudimos cambiar el orden. Revisa tu conexión e inténtalo de nuevo.");
      }
    });
  };

  return (
    <span className="flex gap-1">
      <IconButton
        ref={upRef}
        type="button"
        size="icon-sm"
        variant="ghost"
        label={`Subir ${name}`}
        disabled={first || pending || !hydrated}
        // Disabled only while pending: aria-disabled, so a focused button is not blurred.
        focusableWhenDisabled={pending && !first}
        onClick={() => move("up")}
      >
        <ArrowUp aria-hidden="true" />
      </IconButton>
      <IconButton
        ref={downRef}
        type="button"
        size="icon-sm"
        variant="ghost"
        label={`Bajar ${name}`}
        disabled={last || pending || !hydrated}
        focusableWhenDisabled={pending && !last}
        onClick={() => move("down")}
      >
        <ArrowDown aria-hidden="true" />
      </IconButton>
      <span ref={liveRef} role="status" className="sr-only" data-testid="order-announcement" />
    </span>
  );
}
