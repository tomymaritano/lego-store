"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { pageTransition } from "@/lib/motion";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/** Subtle fade/rise on page enter. Variants live in @/lib/motion. */
export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div initial="hidden" animate="visible" exit="exit" variants={pageTransition} className={className}>
      {children}
    </motion.div>
  );
}
