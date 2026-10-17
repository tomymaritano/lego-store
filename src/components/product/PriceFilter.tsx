"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/utils";
import { Slider } from "@/components/ui";
import type { FilterOptions, ProductFilters as Filters } from "@/types";

const PRICE_STEP = 50;
/** Arrow keys commit once the user pauses, so holding a key is one URL change. */
const KEYBOARD_COMMIT_DELAY = 400;

/**
 * Price range facet: a two-thumb slider over the scope's price bounds (in
 * `PRICE_STEP` steps). Pointer drags commit on release; arrow keys commit
 * once the user pauses. An edge at its bound means "no limit" in the URL.
 */
export function PriceFilter({
  bounds,
  minPrice,
  maxPrice,
  onChange,
}: {
  bounds: FilterOptions["price"];
  minPrice?: number;
  maxPrice?: number;
  onChange: (patch: Partial<Filters>) => void;
}) {
  const floor = Math.floor(bounds.min / PRICE_STEP) * PRICE_STEP;
  const ceil = Math.ceil(bounds.max / PRICE_STEP) * PRICE_STEP;
  const low = Math.max(floor, minPrice ?? floor);
  const high = Math.min(ceil, maxPrice ?? ceil);

  // Local while dragging / pressing keys; the URL changes on commit. The
  // slider is never remounted (that would drop keyboard focus): when the URL
  // changes from elsewhere (a chip, "Limpiar", Back/Forward) the local range
  // follows it here.
  const [range, setRange] = useState<[number, number]>([low, high]);
  const [synced, setSynced] = useState(`${low}-${high}`);
  if (synced !== `${low}-${high}`) {
    setSynced(`${low}-${high}`);
    setRange([low, high]);
  }

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; value: readonly number[] } | null>(null);

  const commit = ([nextLow, nextHigh]: readonly number[]) => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
    onChangeRef.current({
      minPrice: nextLow > floor ? nextLow : undefined,
      maxPrice: nextHigh < ceil ? nextHigh : undefined,
    });
  };

  // A keyboard change still waiting when the filters unmount (the sheet closes) is not lost.
  useEffect(
    () => () => {
      if (pending.current) commit(pending.current.value);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush once, on unmount
    []
  );

  return (
    <fieldset className="flex min-w-0 flex-col gap-3 py-5">
      <legend className="float-left mb-1 flex w-full items-baseline justify-between gap-2 text-label text-fg">
        Precio
        {/* Visual summary; each thumb announces its own value. */}
        <span aria-hidden="true" className="text-label font-normal text-fg-secondary tabular-nums">
          {formatPrice(range[0])} – {formatPrice(range[1])}
        </span>
      </legend>
      <Slider
        min={floor}
        max={ceil}
        step={PRICE_STEP}
        minStepsBetweenValues={1}
        value={range}
        onValueChange={(value) => Array.isArray(value) && setRange([value[0], value[1]])}
        onValueCommitted={(value, details) => {
          if (!Array.isArray(value)) return;
          if (details.reason !== "keyboard") return commit(value);
          if (pending.current) clearTimeout(pending.current.timer);
          pending.current = { value, timer: setTimeout(() => commit(value), KEYBOARD_COMMIT_DELAY) };
        }}
        thumbLabels={["Precio mínimo", "Precio máximo"]}
        formatValueText={formatPrice}
        className="px-2.5"
      />
    </fieldset>
  );
}
