"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { scaleIn, staggerContainer, staggerItem } from "@/lib/motion";

/*
 * Motion wrappers for Server Components: pages stay server-rendered and only
 * these tiny islands run on the client. Children stagger in on mount, or when
 * scrolled into view with `inView`.
 */

interface StaggerProps {
  children: ReactNode;
  className?: string;
  /** Seconds between children. */
  stagger?: number;
  delay?: number;
  /** Animate when scrolled into view (once) instead of on mount. */
  inView?: boolean;
  as?: "div" | "ul";
}

export function Stagger({ children, className, stagger = 0.06, delay = 0, inView = false, as = "div" }: StaggerProps) {
  const Component = as === "ul" ? motion.ul : motion.div;
  const trigger = inView
    ? { whileInView: "visible", viewport: { once: true, margin: "-80px" } }
    : { animate: "visible" };
  return (
    <Component className={className} variants={staggerContainer(stagger, delay)} initial="hidden" {...trigger}>
      {children}
    </Component>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  /** "rise" fades up (default), "pop" scales in. */
  effect?: "rise" | "pop";
  as?: "div" | "li";
}

export function StaggerItem({ children, className, effect = "rise", as = "div" }: StaggerItemProps) {
  const Component = as === "li" ? motion.li : motion.div;
  return (
    <Component className={className} variants={effect === "pop" ? scaleIn : staggerItem}>
      {children}
    </Component>
  );
}
