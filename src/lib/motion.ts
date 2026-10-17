import type { Transition, Variants } from "motion/react";

/**
 * Shared motion language. Durations mirror the CSS tokens in globals.css
 * (--duration-fast/base/slow); `__tests__/design/tokens.test.ts` keeps them
 * in sync. Everything here is fast (150–300ms) and never delays interaction.
 *
 * Variant labels are always `hidden` / `visible` / `exit`, so containers and
 * items compose: <m.ul variants={staggerContainer()} initial="hidden"
 * animate="visible"> with <m.li variants={staggerItem}>. Components render
 * motion's light `m.*` elements; ClientProviders loads the features lazily.
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

/**
 * Wizard steps (checkout). `custom` is the direction of travel (1 = forward,
 * -1 = back): going forward the new step enters from the right and the old
 * one leaves to the left; going back it mirrors. Pass the same `custom` to
 * AnimatePresence so the exiting step uses the latest direction.
 */
export const stepSlide: Variants = {
  hidden: (direction: number = 1) => ({ opacity: 0, x: direction * 24 }),
  visible: { opacity: 1, x: 0, transition: transitions.slow },
  exit: (direction: number = 1) => ({ opacity: 0, x: direction * -24, transition: transitions.exit }),
};

/** Success mark: the circle pops in with a spring, then the tick draws itself. */
export const successPop: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 380, damping: 18 } },
};

export const drawPath: Variants = {
  hidden: { pathLength: 0 },
  visible: { pathLength: 1, transition: { ...transitions.slow, delay: duration.fast } },
};

/**
 * Product gallery slides. `custom` is the direction of travel (1 = next,
 * -1 = previous): the new picture enters from that side and the old one
 * leaves through the other. Pass the same `custom` to AnimatePresence so the
 * exiting slide uses the latest direction.
 */
export const gallerySlide: Variants = {
  hidden: (direction: number = 1) => ({ opacity: 0, x: direction * 48 }),
  visible: { opacity: 1, x: 0, transition: transitions.slow },
  exit: (direction: number = 1) => ({ opacity: 0, x: direction * -48, transition: transitions.exit }),
};

/** List rows that are removed by the user (cart): enter up, leave to the left. */
export const dismissible: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: transitions.slow },
  exit: { opacity: 0, x: -48, transition: transitions.exit },
};

/** Inline panels that open in place (mobile search, review form). */
export const collapse: Variants = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: "auto", transition: transitions.base },
  exit: { opacity: 0, height: 0, transition: transitions.exit },
};

/** Menus that drop down from their trigger. */
export const dropDown: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: transitions.fast },
  exit: { opacity: 0, y: -8, transition: transitions.exit },
};

/** Bars docked to the bottom of the viewport (compare bar). */
export const slideUp: Variants = {
  hidden: { opacity: 0, y: "100%" },
  visible: { opacity: 1, y: 0, transition: transitions.slow },
  exit: { opacity: 0, y: "100%", transition: transitions.exit },
};

/** Seconds between staggered children: lists, grids and page sections share it. */
export const STAGGER = 0.04;

/** Parent of a staggered list/grid. Keep `stagger` small so long grids stay fast. */
export function staggerContainer(stagger = STAGGER, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: stagger, delayChildren } },
    exit: {},
  };
}

/** Child of `staggerContainer` (the name call sites use; same curve as fadeInUp). */
export const staggerItem: Variants = fadeInUp;

/** Cap on a grid cell's delay, so a full page of cards stays within the motion budget. */
const GRID_MAX_DELAY = 0.24;

/**
 * Product grid cells. `custom` is the cell's index within the batch that
 * arrived together (a page, a filter result), so each batch staggers on its
 * own. Cells that leave (filtered out) shrink away while the rest reflow
 * with `layout`.
 */
export const gridItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: { ...transitions.slow, delay: Math.min(index * STAGGER, GRID_MAX_DELAY) },
  }),
  exit: { opacity: 0, scale: 0.96, transition: transitions.exit },
};

/**
 * Above-the-fold entrance that never hides content: it only moves (no
 * opacity), so server HTML is readable before hydration and the hero text
 * counts for LCP straight away. Use with a stagger container.
 */
export const riseIn: Variants = {
  hidden: { y: 16 },
  visible: { y: 0, transition: transitions.slow },
};

/**
 * Hover lift for cards and other containers. Spread on a motion element:
 * <m.article {...hoverLift}>. Hover only: a container is not a control
 * (`whileTap` would make Motion add tabindex="0" to it).
 */
export const hoverLift = {
  whileHover: { y: -4 },
  transition: transitions.fast,
} as const;

/** Subtle page enter used by PageTransition. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transitions.slow },
  exit: { opacity: 0, transition: transitions.exit },
};
