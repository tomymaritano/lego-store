"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { fadeInUp, riseIn, scaleIn, staggerContainer, staggerItem } from "@/lib/motion";

/*
 * Motion wrappers for Server Components: pages stay server-rendered and only
 * these tiny islands run on the client. Children stagger in on mount, or when
 * scrolled into view with `inView`.
 */

/** Scroll-reveal fires a little before the element is fully in view, and only once. */
const VIEWPORT = { once: true, margin: "0px 0px -80px" } as const;

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
  const trigger = inView ? { whileInView: "visible", viewport: VIEWPORT } : { animate: "visible" };
  return (
    <Component className={className} variants={staggerContainer(stagger, delay)} initial="hidden" {...trigger}>
      {children}
    </Component>
  );
}

const effects = { rise: staggerItem, pop: scaleIn, lift: riseIn } as const;

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  /**
   * "rise" fades up (default), "pop" scales in, "lift" only moves (never
   * hidden: use it above the fold, where content must show before hydration).
   */
  effect?: keyof typeof effects;
  as?: "div" | "li";
}

export function StaggerItem({ children, className, effect = "rise", as = "div" }: StaggerItemProps) {
  const Component = as === "li" ? motion.li : motion.div;
  return (
    <Component className={className} variants={effects[effect]}>
      {children}
    </Component>
  );
}

/** One block that fades up when scrolled into view (section headers, banners). */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={fadeInUp} initial="hidden" whileInView="visible" viewport={VIEWPORT}>
      {children}
    </motion.div>
  );
}
