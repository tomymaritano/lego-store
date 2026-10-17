"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { transitions } from "@/lib/motion";
import { CompareBar } from "@/components/product/CompareBar";
import { StoreHydrator } from "@/stores";
import { ThemeSync } from "./ThemeSync";

/**
 * Client-only app shell: loads the persisted stores once (StoreHydrator),
 * keeps the theme class in sync, and sets the global motion policy
 * (animations respect prefers-reduced-motion everywhere, and any motion
 * element without its own transition uses the token timing).
 */
export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={transitions.base}>
      <StoreHydrator />
      <ThemeSync />
      {children}
      <CompareBar />
    </MotionConfig>
  );
}
