"use client";

import { useTransition } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useHydrated } from "@/hooks/useHydrated";
import { IconButton, showToast } from "@/components/ui";
import type { ConfirmActionResult } from "./ConfirmAction";

interface OrderButtonsProps {
  /** What is moved, for the buttons' names ("Helmets"). */
  name: string;
  first: boolean;
  last: boolean;
  /** A Server Action bound to the row's id, taking the direction. */
  action: (direction: "up" | "down") => Promise<ConfirmActionResult>;
}

/**
 * "Subir" / "Bajar" for a row of an ordered admin list (categories, themes):
 * the keyboard-friendly way to reorder (no dragging needed). The page
 * re-renders in the new order; a failure is a toast.
 */
export function OrderButtons({ name, first, last, action }: OrderButtonsProps) {
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const move = (direction: "up" | "down") =>
    startTransition(async () => {
      try {
        const result = await action(direction);
        if (!result.ok) showToast.error(result.error);
      } catch {
        showToast.error("No pudimos cambiar el orden. Revisa tu conexión e inténtalo de nuevo.");
      }
    });
  return (
    <span className="flex gap-1">
      <IconButton type="button" size="icon-sm" variant="ghost" label={`Subir ${name}`} disabled={first || pending || !hydrated} onClick={() => move("up")}>
        <ArrowUp aria-hidden="true" />
      </IconButton>
      <IconButton type="button" size="icon-sm" variant="ghost" label={`Bajar ${name}`} disabled={last || pending || !hydrated} onClick={() => move("down")}>
        <ArrowDown aria-hidden="true" />
      </IconButton>
    </span>
  );
}
