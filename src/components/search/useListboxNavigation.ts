"use client";

import { useEffect, useState } from "react";

/**
 * Keyboard model of a combobox listbox (aria-activedescendant): the index of
 * the highlighted option, wrapping with the arrow keys. It resets to "none"
 * whenever `optionsKey` changes (a new option list), and keeps the
 * highlighted option scrolled into view.
 */
export function useListboxNavigation(listboxId: string, optionCount: number, optionsKey: string) {
  const [activeIndex, setActiveIndex] = useState(-1);

  const [prevKey, setPrevKey] = useState(optionsKey);
  if (optionsKey !== prevKey) {
    setPrevKey(optionsKey);
    setActiveIndex(-1);
  }

  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const activeOptionId = activeIndex >= 0 ? optionId(activeIndex) : null;

  useEffect(() => {
    if (activeOptionId) document.getElementById(activeOptionId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeOptionId]);

  return {
    activeIndex,
    activeOptionId,
    optionId,
    setActiveIndex,
    next: () => {
      if (optionCount) setActiveIndex((i) => (i + 1) % optionCount);
    },
    previous: () => {
      if (optionCount) setActiveIndex((i) => (i <= 0 ? optionCount - 1 : i - 1));
    },
    reset: () => setActiveIndex(-1),
  };
}
