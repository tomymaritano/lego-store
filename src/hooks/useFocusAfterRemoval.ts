"use client";

import { useCallback, useEffect, useRef } from "react";

type FocusTarget = () => HTMLElement | null | undefined;

/**
 * Keeps keyboard focus on the page when an action removes the control that
 * had it (archiving an inbox row, "Dar de baja" swapping the button for a
 * badge): `arm(target)` before the action; if this component unmounts while
 * armed and the focus ended up on <body>, `target()` gets it on the next
 * frame (once the new content is in). `disarm()` once the control is known
 * to stay. Nothing happens unless armed, so a normal unmount (navigating
 * away, Strict Mode's double effects) never moves the focus.
 */
export function useFocusAfterRemoval() {
  const plan = useRef<FocusTarget | null>(null);

  useEffect(() => {
    const armed = plan;
    return () => {
      const target = armed.current;
      if (!target) return;
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active && active !== document.body && active.isConnected) return;
        target()?.focus();
      });
    };
  }, []);

  const arm = useCallback((target: FocusTarget) => {
    plan.current = target;
  }, []);
  const disarm = useCallback(() => {
    plan.current = null;
  }, []);
  return { arm, disarm };
}
