import type { Transition, Variants } from "motion/react";

/**
 * Shared motion language. Durations mirror the CSS tokens in globals.css
 * (--duration-fast/base/slow); `__tests__/design/tokens.test.ts` keeps them
 * in sync. Everything here is fast (150–300ms) and never delays interaction.
 *
 * Variant labels are always `hidden` / `visible` / `exit`, so containers and
 * items compose: <motion.ul variants={staggerContainer()} initial="hidden"
 * animate="visible"> with <motion.li variants={staggerItem}>.
 *
 * Reduced motion is handled once by <MotionConfig reducedMotion="user"> in
 * ClientProviders: transform animations are skipped, opacity still fades.
 *
 * Only export what has a consumer. ESLint flags numeric `duration:` literals
 * in motion props, so new call sites reach for these presets. Panels
 * (Sheet, Dialog) animate with CSS data-starting/ending-style instead.
 */

/** Seconds, matching --duration-* in globals.css. */
export const duration = {
  fast: 0.15,
  base: 0.2,
  slow: 0.3,
} as const;

/** Cubic-bezier curves, matching --ease-* in globals.css. */
export const ease = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.22, 1, 0.36, 1],
  exit: [0.4, 0, 1, 1],
} as const;

export const transitions = {
  fast: { duration: duration.fast, ease: ease.standard },
  base: { duration: duration.base, ease: ease.standard },
  slow: { duration: duration.slow, ease: ease.emphasized },
  exit: { duration: duration.fast, ease: ease.exit },
  /** Snappy spring for layout changes (cart rows, filter chips). */
  spring: { type: "spring", stiffness: 420, damping: 34, mass: 0.8 },
} satisfies Record<string, Transition>;

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.base },
  exit: { opacity: 0, transition: transitions.exit },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: transitions.slow },
  exit: { opacity: 0, y: 8, transition: transitions.exit },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: transitions.base },
  exit: { opacity: 0, scale: 0.98, transition: transitions.exit },
};

/** Parent of a staggered list/grid. Keep `stagger` small so long grids stay fast. */
export function staggerContainer(stagger = 0.04, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: stagger, delayChildren } },
    exit: {},
  };
}

/** Child of `staggerContainer`. */
export const staggerItem: Variants = fadeInUp;

/**
 * Hover lift + press for interactive cards. Spread on a motion element:
 * <motion.article {...pressable}>.
 */
export const pressable = {
  whileHover: { y: -4 },
  whileTap: { scale: 0.98 },
  transition: transitions.fast,
} as const;

/** Subtle page enter used by PageTransition. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transitions.slow },
  exit: { opacity: 0, transition: transitions.exit },
};
