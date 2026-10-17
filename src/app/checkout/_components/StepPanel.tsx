"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { m } from "motion/react";
import { stepSlide } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Direction of the last step change: 1 forward, -1 back (drives stepSlide). */
export const StepDirectionContext = createContext(1);

interface StepPanelProps {
  /** Id of the heading; the section is labelled by it. */
  titleId: string;
  title: React.ReactNode;
  icon?: React.ReactNode;
  /** Move focus to the heading on mount (after the visitor changed step). */
  focusHeading: boolean;
  /** Extra content on the heading row (e.g. "Paso 1 de 3"). */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  "aria-busy"?: boolean;
}

/**
 * One checkout step: a labelled section that slides in from the direction of
 * travel (AnimatePresence passes `custom`). When the visitor moves between
 * steps, focus lands on the heading so screen readers announce the new step
 * and keyboard users continue from the top of it.
 */
export function StepPanel({ titleId, title, icon, focusHeading, aside, className, children, ...props }: StepPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const direction = useContext(StepDirectionContext);

  useEffect(() => {
    if (focusHeading) headingRef.current?.focus();
  }, [focusHeading]);

  return (
    <m.section
      aria-labelledby={titleId}
      variants={stepSlide}
      custom={direction}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn("rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-8", className)}
      {...props}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h2
          id={titleId}
          ref={headingRef}
          tabIndex={-1}
          className="flex scroll-mt-32 items-center gap-2 text-title text-fg outline-none"
        >
          {icon ? (
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-bg-subtle text-info [&_svg]:size-5">
              {icon}
            </span>
          ) : null}
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </m.section>
  );
}

/** "Paso 2 de 3" next to a step's heading. */
export function StepCount({ index, total }: { index: number; total: number }) {
  return (
    <p className="text-caption font-semibold tracking-wide text-fg-muted uppercase">
      Paso {index + 1} de {total}
    </p>
  );
}
