"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Whether a scroller has more content past its start or end edge
 * (left/right for "x", top/bottom for "y"). Drives the fade that tells a
 * cut-off column or list apart from overflow. Re-measures on scroll and
 * when the scroller or its content resizes.
 */
export function useScrollEdges<T extends HTMLElement>(axis: "x" | "y" = "x") {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const vertical = axis === "y";
      const max = vertical ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
      const offset = vertical ? el.scrollTop : el.scrollLeft;
      const start = offset > 1;
      const end = offset < max - 1;
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [axis]);

  return [ref, edges] as const;
}
