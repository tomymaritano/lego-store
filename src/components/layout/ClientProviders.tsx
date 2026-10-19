"use client";

import type { ReactNode } from "react";
import { LazyMotion, MotionConfig } from "motion/react";
import { transitions } from "@/lib/motion";
import { CompareBar } from "@/components/product/CompareBar";
import { StoreHydrator } from "@/stores";
import { ListsSync } from "./ListsSync";
import { ThemeSync } from "./ThemeSync";

/**
 * Client-only app shell: loads the persisted stores once (StoreHydrator),
 * keeps the cart and wishlist in step with the account (ListsSync), keeps
 * the theme class in sync, and sets the global motion policy
 * (animations respect prefers-reduced-motion everywhere, and any motion
 * element without its own transition uses the token timing).
 *
 * Motion runs through LazyMotion: components use the light `m.*` elements
 * and the feature bundle (animation, gestures, layout, drag: domMax, needed
 * app-wide for the layout animations) is requested from lib/motion-features.
 * Note: Turbopack currently places domMax's modules in the shared motion
 * chunk the `m` elements already load (~45 kB gzip in every route's first
 * load, measured with `npm run size`); switching to domAnimation saves
 * ~14 kB but drops layout and drag. `strict` makes a stray full `motion.*`
 * import throw in development.
 */
const loadMotionFeatures = () => import("@/lib/motion-features").then((mod) => mod.default);

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user" transition={transitions.base}>
        <StoreHydrator />
        <ListsSync />
        <ThemeSync />
        {children}
        <CompareBar />
      </MotionConfig>
    </LazyMotion>
  );
}
