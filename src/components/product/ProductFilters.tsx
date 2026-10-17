"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { formatPrice } from "@/lib/utils";
import { Button, Checkbox, RadioGroup, RadioGroupItem, Slider } from "@/components/ui";
import type { FacetCounts, FilterOption, FilterOptions, ProductFilters as Filters, ProductQuery } from "@/types";

type ListField = "themes" | "types" | "ages" | "pieces" | "highlights";
type CountedFacet = ListField | "categories" | "ratings";

export interface ProductFiltersProps {
  /** Values and counts in the page's scope (getFilterOptions). */
  options: FilterOptions;
  /**
   * Counts that follow the active filters (getFacetCounts). Which options are
   * listed still comes from `options`; only the numbers change. Without it the
   * scope totals from `options` are shown.
   */
  counts?: FacetCounts;
  /** The current query (from the URL). */
  query: ProductQuery;
  /** Called with the fields that change; `undefined` removes a filter. */
  onChange: (patch: Partial<Filters>) => void;
  /** Offer the category facet (search / whole catalogue, not a category page). */
  showCategories?: boolean;
}

/** Long lists show this many values until "Ver todos". */
const VISIBLE_VALUES = 6;

const LIST_SECTIONS: { field: ListField; legend: string }[] = [
  { field: "themes", legend: "Tema" },
  { field: "types", legend: "Tipo" },
  { field: "ages", legend: "Edad" },
  { field: "pieces", legend: "Piezas" },
  { field: "highlights", legend: "Colección" },
];

/**
 * Catalogue filters: availability toggles, a price range, a minimum rating
 * and facets with counts (checkboxes, OR within a facet). Controlled: the
 * page keeps the state in the URL. Shown as a sidebar on desktop and inside
 * a Sheet on phones (see CatalogView).
 */
export function ProductFilters({ options, counts, query, onChange, showCategories = false }: ProductFiltersProps) {
  /** The option with its live count, when there are live counts. */
  const live = (field: CountedFacet, option: FilterOption) =>
    counts ? { ...option, count: counts[field][option.value] ?? 0 } : option;

  const toggle = (field: ListField, value: string, checked: boolean) => {
    const current = query[field] ?? [];
    const next = checked ? [...current, value] : current.filter((v) => v !== value);
    onChange({ [field]: next.length ? next : undefined });
  };

  const flags = [
    { field: "onSale", label: "En oferta" },
    { field: "isNew", label: "Novedades" },
    { field: "inStock", label: "En stock" },
  ] as const;

  return (
    <div className="flex flex-col divide-y divide-border" data-testid="product-filters">
      <FilterGroup legend="Disponibilidad">
        {flags
          // Listed when the scope has any; the number follows the other filters.
          .filter((flag) => options.flags[flag.field] > 0 || query[flag.field])
          .map((flag) => (
            <Checkbox
              key={flag.field}
              checked={!!query[flag.field]}
              onCheckedChange={(checked) => onChange({ [flag.field]: checked || undefined })}
              label={<OptionLabel label={flag.label} count={(counts ?? options).flags[flag.field]} />}
            />
          ))}
      </FilterGroup>

      {showCategories && options.categories.length > 1 ? (
        <FilterGroup legend="Categoría">
          <RadioGroup
            aria-label="Categoría"
            value={query.category ?? ""}
            onValueChange={(value) => onChange({ category: (value as string) || undefined })}
            className="gap-2.5"
          >
            <RadioGroupItem value="" label={<OptionLabel label="Todas" count={counts?.anyCategory ?? options.total} />} />
            {options.categories.map((option) => (
              <RadioGroupItem
                key={option.value}
                value={option.value}
                label={<OptionLabel {...live("categories", option)} />}
              />
            ))}
          </RadioGroup>
        </FilterGroup>
      ) : null}

      {/* Price and rating first: short, and visible without scrolling the sidebar. */}
      {options.price.max > options.price.min ? (
        <PriceFilter
          bounds={options.price}
          minPrice={query.minPrice}
          maxPrice={query.maxPrice}
          onChange={onChange}
        />
      ) : null}

      {options.ratings.length > 0 ? (
        <FilterGroup legend="Calificación">
          <RadioGroup
            aria-label="Calificación mínima"
            value={query.minRating === undefined ? "" : String(query.minRating)}
            onValueChange={(value) => onChange({ minRating: value ? Number(value) : undefined })}
            className="gap-2.5"
          >
            <RadioGroupItem value="" label={<OptionLabel label="Todas" count={counts?.anyRating ?? options.total} />} />
            {options.ratings.map((option) => (
              <RadioGroupItem
                key={option.value}
                value={option.value}
                label={<OptionLabel {...live("ratings", option)} />}
              />
            ))}
          </RadioGroup>
        </FilterGroup>
      ) : null}

      {LIST_SECTIONS.map(({ field, legend }) => {
        const values = options[field].map((option) => live(field, option));
        const selected = query[field] ?? [];
        // A facet with a single value does not narrow anything, unless it is selected.
        if (values.length < 2 && selected.length === 0) return null;
        return (
          <FilterGroup key={field} legend={legend}>
            <OptionList
              options={values}
              selected={selected}
              onToggle={(value, checked) => toggle(field, value, checked)}
              legend={legend}
            />
          </FilterGroup>
        );
      })}

    </div>
  );
}

function FilterGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2.5 py-5 first:pt-0 last:pb-0">
      <legend className="float-left mb-3 w-full text-label text-fg">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** "Star Wars (9)": the count is part of the accessible name too. */
function OptionLabel({ label, count }: Pick<FilterOption, "label" | "count">) {
  return (
    <>
      {label} <span className="text-caption text-fg-muted tabular-nums">({count})</span>
    </>
  );
}

function OptionList({
  options,
  selected,
  onToggle,
  legend,
}: {
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string, checked: boolean) => void;
  legend: string;
}) {
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  // Selected values always stay visible, even past the cut.
  const visible = expanded
    ? options
    : options.filter((option, index) => index < VISIBLE_VALUES || selected.includes(option.value));
  const hidden = options.length - visible.length;

  return (
    <>
      <div id={listId} className="flex flex-col gap-2.5">
        {visible.map((option) => (
          <Checkbox
            key={option.value}
            checked={selected.includes(option.value)}
            onCheckedChange={(checked) => onToggle(option.value, checked)}
            label={<OptionLabel {...option} />}
          />
        ))}
      </div>
      {hidden > 0 || expanded ? (
        <Button
          variant="link"
          size="sm"
          className="self-start"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? `Ver menos de ${legend.toLowerCase()}` : `Ver ${hidden} más`}
        </Button>
      ) : null}
    </>
  );
}

const PRICE_STEP = 50;
/** Arrow keys commit once the user pauses, so holding a key is one URL change. */
const KEYBOARD_COMMIT_DELAY = 400;

function PriceFilter({
  bounds,
  minPrice,
  maxPrice,
  onChange,
}: {
  bounds: FilterOptions["price"];
  minPrice?: number;
  maxPrice?: number;
  onChange: ProductFiltersProps["onChange"];
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
        <span aria-hidden="true" className="text-sm font-normal text-fg-secondary tabular-nums">
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
