"use client";

import type { ComponentProps } from "react";
import { AnimatePresence, motion } from "motion/react";
import { transitions } from "@/lib/motion";
import { cn, formatPrice } from "@/lib/utils";

/**
 * A price that ticks when it changes: the old amount slides out downwards and
 * the new one drops in (150ms). Under reduced motion it simply cross-fades.
 */
export function TickingPrice({ value, className, ...props }: { value: number; className?: string } & ComponentProps<"span">) {
  return (
    <span className={cn("relative inline-flex overflow-hidden tabular-nums", className)} {...props}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: "-60%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "60%", opacity: 0 }}
          transition={transitions.fast}
        >
          {formatPrice(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
