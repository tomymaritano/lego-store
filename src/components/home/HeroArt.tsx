"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { scaleIn, transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface HeroArtProps {
  src: string;
  alt: string;
}

/** A 2×2 LEGO brick drawn with tokens (decorative). */
function Brick({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("grid grid-cols-2 gap-1.5 rounded-lg p-2 shadow-lg", className)}>
      {Array.from({ length: 4 }).map((_, i) => (
        <span key={i} className="size-4 rounded-full bg-current opacity-30 shadow-inner" />
      ))}
    </span>
  );
}

/**
 * Hero picture: pops in on load and drifts with a gentle parallax while the
 * page scrolls, with two loose bricks moving at a different rate for depth.
 * Under reduced motion it stays still.
 */
export function HeroArt({ src, alt }: HeroArtProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 60]);
  const bricksY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, -40]);

  return (
    <div ref={ref} className="relative mx-auto aspect-square w-full max-w-lg">
      <div aria-hidden="true" className="absolute inset-10 rounded-full bg-surface/40 blur-3xl" />

      <motion.div style={{ y: bricksY }} aria-hidden="true" className="absolute inset-0">
        <motion.div
          initial={{ opacity: 0, rotate: -24, scale: 0.6 }}
          animate={{ opacity: 1, rotate: -12, scale: 1 }}
          transition={{ ...transitions.spring, delay: transitions.slow.duration }}
          className="absolute top-6 left-2"
        >
          <Brick className="bg-brand-red text-on-brand-red" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, rotate: 24, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 10, scale: 1 }}
          transition={{ ...transitions.spring, delay: transitions.slow.duration + transitions.fast.duration }}
          className="absolute right-4 bottom-10"
        >
          <Brick className="bg-info-surface text-on-info-surface" />
        </motion.div>
      </motion.div>

      <motion.div style={{ y: imageY }} className="absolute inset-0">
        <motion.div variants={scaleIn} initial="hidden" animate="visible" className="relative size-full">
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 1023px) 0px, 512px"
            className="object-contain drop-shadow-2xl transition-[scale] duration-slow ease-emphasized hover:scale-105 motion-reduce:hover:scale-100"
            preload
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
