"use client";

import { useEffect, useState } from "react";

/** Pixels of travel in one direction before the state flips (ignores jitter). */
const THRESHOLD = 12;
/** Near the top or the bottom of the page the bar always shows. */
const EDGE = 120;

/**
 * True while the visitor is scrolling down the page, false when they scroll
 * up or reach the top or the bottom. Floating bars use it to tuck away while
 * the visitor reads, so they never sit over the content being read.
 * Only listens while `enabled`; resets to false when disabled.
 */
export function useTuckOnScroll(enabled = true): boolean {
  const [tucked, setTucked] = useState(false);
  if (!enabled && tucked) setTucked(false);

  useEffect(() => {
    if (!enabled) return;
    let anchor = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const atEdge = y < EDGE || y + window.innerHeight >= document.documentElement.scrollHeight - EDGE;
      if (atEdge) {
        anchor = y;
        setTucked(false);
      } else if (y - anchor > THRESHOLD) {
        anchor = y;
        setTucked(true);
      } else if (anchor - y > THRESHOLD) {
        anchor = y;
        setTucked(false);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return tucked;
}
