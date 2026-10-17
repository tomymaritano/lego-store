"use client";

import type { ReactNode } from "react";
import { LazyMotion, MotionConfig } from "motion/react";
import { transitions } from "@/lib/motion";
import { CompareBar } from "@/components/product/CompareBar";
import { StoreHydrator } from "@/stores";
import { ThemeSync } from "./ThemeSync";

/**
 * Client-only app shell: loads the persisted stores once (StoreHydrator),
 * keeps the theme class in sync, and sets the global motion policy
 * (animations respect prefers-reduced-motion everywhere, and any motion
 * element without its own transition uses the token timing).
 *
 * Motion runs through LazyMotion: components use the light `m.*` elements
 * and the feature bundle loads asynchronously (lib/motion-features), so the
 * animation engine is not part of every route's first-load JS. `strict`
 * makes a stray full `motion.*` import throw in development.
 */
const loadMotionFeatures = () => import("@/lib/motion-features").then((mod) => mod.default);

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user" transition={transitions.base}>
        <StoreHydrator />
        <ThemeSync />
        {children}
        <CompareBar />
      </MotionConfig>
    </LazyMotion>
  );
}
