"use client";

import { m } from "motion/react";
import { Check } from "lucide-react";
import { transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { CheckoutStep } from "@/types";
import { WIZARD_STEPS, stepIndex } from "./steps";

/**
 * Checkout progress: an ordered list in a nav landmark. The current step has
 * aria-current="step"; finished steps say "(completado)" to screen readers
 * and show a tick. The connectors fill as the visitor moves forward.
 */
export function Stepper({ current }: { current: CheckoutStep }) {
  const currentIndex = stepIndex(current);

  return (
    <nav aria-label="Pasos del checkout" className="mx-auto w-full max-w-xl">
      <ol className="flex items-start">
        {WIZARD_STEPS.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          return (
            <li
              key={step.id}
              aria-current={isActive ? "step" : undefined}
              className="relative flex flex-1 flex-col items-center gap-2 text-center"
            >
              {index > 0 && (
                <span aria-hidden="true" className="absolute top-4 right-1/2 h-1 w-full -translate-y-1/2">
                  <span className="block h-full overflow-hidden rounded-full bg-bg-muted">
                    <m.span
                      className="block h-full origin-left bg-success"
                      initial={false}
                      animate={{ scaleX: index <= currentIndex ? 1 : 0 }}
                      transition={transitions.slow}
                    />
                  </span>
                </span>
              )}
              <m.span
                aria-hidden="true"
                initial={false}
                animate={{ scale: isActive ? 1.08 : 1 }}
                transition={transitions.spring}
                className={cn(
                  "relative z-10 flex size-8 items-center justify-center rounded-full text-label font-bold ring-4 ring-bg-subtle",
                  "transition-colors duration-base ease-standard",
                  isActive && "bg-primary text-on-primary",
                  isCompleted && "bg-success text-on-success",
                  !isActive && !isCompleted && "bg-bg-muted text-fg-muted"
                )}
              >
                {isCompleted ? <Check className="size-4" strokeWidth={3} /> : index + 1}
              </m.span>
              <span className={cn("text-label font-normal", isActive ? "font-semibold text-fg" : "text-fg-muted")}>
                {step.label}
                {isCompleted && <span className="sr-only"> (completado)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
