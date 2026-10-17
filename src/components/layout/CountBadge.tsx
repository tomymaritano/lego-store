"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useStoresHydrated } from "@/stores";

/**
 * Bumps the returned element when `count` goes up after the stores have
 * hydrated: real add-to-cart/wishlist/compare feedback, never on page load
 * (the hydrated value is the baseline) nor on removals.
 */
function useBumpOnIncrease<T extends HTMLElement>(count: number) {
  const hydrated = useStoresHydrated();
  const reduceMotion = useReducedMotion();
  const [scope, animate] = useAnimate<T>();
  const previous = useRef<number | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const before = previous.current;
    previous.current = count;
    if (before === null || count <= before || reduceMotion || !scope.current) return;
    animate(scope.current, { scale: [1, 1.25, 0.95, 1] }, transitions.slow);
  }, [hydrated, count, reduceMotion, animate, scope]);

  return scope;
}

interface CountIconProps {
  icon: ReactNode;
  count: number;
  /** data-testid of the bubble (e2e). */
  testId: string;
  tone?: "primary" | "sale" | "info";
}

const tones = {
  primary: "bg-primary text-on-primary",
  sale: "bg-sale text-on-sale",
  info: "bg-info text-on-info",
} as const;

/**
 * Icon with a count bubble for the Navbar actions. The icon and bubble bump
 * together when the count grows; the bubble pops in from 0 and fades out at 0.
 * Static on page load: the bubble only renders once the stores are hydrated,
 * with exit/enter animations from then on. Decorative: the button's label
 * carries the count.
 */
export function CountIcon({ icon, count, testId, tone = "primary" }: CountIconProps) {
  const hydrated = useStoresHydrated();
  const scope = useBumpOnIncrease<HTMLSpanElement>(count);

  return (
    <span ref={scope} className="relative flex">
      {icon}
      {hydrated ? (
        <AnimatePresence initial={false}>
          {count > 0 && (
            <motion.span
              key="badge"
              aria-hidden="true"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={transitions.spring}
              className={cn(
                "absolute -top-2.5 -right-3 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-caption leading-none font-bold tabular-nums ring-2 ring-surface",
                tones[tone]
              )}
              data-testid={testId}
            >
              {count > 99 ? "99+" : count}
            </motion.span>
          )}
        </AnimatePresence>
      ) : null}
    </span>
  );
}
