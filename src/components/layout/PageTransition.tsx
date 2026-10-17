"use client";

import { useEffect, useState, type ReactNode } from "react";
import { m } from "motion/react";
import { pageTransition } from "@/lib/motion";

/** Becomes true after the first client render; module scope, so it survives template remounts. */
let hasNavigated = false;

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Subtle fade/rise when a page is entered by client navigation (mounted by
 * app/template.tsx, which remounts on route change). The first page load
 * renders at full opacity straight from the server HTML: no hidden content
 * before hydration (LCP, no-JS). Reduced motion keeps only the fade (MotionConfig).
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const [animateIn] = useState(() => hasNavigated);

  useEffect(() => {
    hasNavigated = true;
  }, []);

  return (
    <m.div initial={animateIn ? "hidden" : false} animate="visible" variants={pageTransition} className={className}>
      {children}
    </m.div>
  );
}
