import type { ReactNode } from "react";
import { scaleLinear } from "d3-scale";
import { cn } from "@/lib/utils";

/*
 * The dashboard's charts, as HTML on the design system's tokens (Server
 * Components, no client JavaScript): d3-scale picks the "nice" axis and its
 * ticks, the marks are plain elements, so text stays crisp at any width and
 * light/dark follow the tokens. One series per chart, in the info blue
 * (>= 3:1 against the surface in both themes); text wears text tokens.
 *
 * Accessibility: each chart is a figure with a visible title and a one-line
 * summary (aria-describedby); the marks are hidden from assistive tech, and
 * the same numbers are in a table under "Ver los datos" (keyboard and
 * screen-reader access, and the forced-colors fallback). Hovering a mark
 * shows its value.
 */

export interface ChartFrameProps {
  id: string;
  title: string;
  /** One sentence with the chart's headline numbers (also what screen readers get). */
  summary: string;
  children: ReactNode;
  /** The data as a table (shown on demand). */
  table: { caption: string; columns: string[]; rows: (string | number)[][]; numeric?: boolean[] };
  className?: string;
  /** Shown instead of the plot when there is nothing to draw. */
  empty?: string | null;
}

export function ChartFrame({ id, title, summary, children, table, className, empty }: ChartFrameProps) {
  return (
    <figure aria-labelledby={`${id}-title`} aria-describedby={`${id}-summary`} className={cn("flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card", className)} data-testid={`chart-${id}`}>
      <div>
        <h3 id={`${id}-title`} className="text-title text-fg">
          {title}
        </h3>
        <p id={`${id}-summary`} className="mt-1 text-label font-normal text-fg-secondary">
          {summary}
        </p>
      </div>
      {empty ? <p className="rounded-xl bg-bg-subtle px-4 py-8 text-center text-label font-normal text-fg-muted">{empty}</p> : <div aria-hidden="true">{children}</div>}
      {table.rows.length > 0 ? (
        <details className="group text-label">
          <summary className="w-fit cursor-pointer rounded-sm font-medium text-fg-secondary underline-offset-4 hover:text-fg hover:underline">Ver los datos</summary>
          <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-border">
            <table className="w-full text-left font-normal">
              <caption className="sr-only">{table.caption}</caption>
              <thead className="sticky top-0 bg-bg-muted text-fg">
                <tr>
                  {table.columns.map((column, index) => (
                    <th key={column} scope="col" className={cn("px-3 py-2 font-semibold", table.numeric?.[index] && "text-right")}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-fg-secondary">
                {table.rows.map((row) => (
                  <tr key={String(row[0])}>
                    {row.map((cell, index) =>
                      index === 0 ? (
                        <th key={index} scope="row" className="px-3 py-2 font-medium text-fg">
                          {cell}
                        </th>
                      ) : (
                        <td key={index} className={cn("px-3 py-2 tabular-nums", table.numeric?.[index] && "text-right")}>
                          {cell}
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </figure>
  );
}

/** The y axis' nice maximum and ticks for these values (at least 1, so an all-zero chart still has an axis). */
export function niceAxis(values: number[], ticks = 4): { max: number; ticks: number[] } {
  const scale = scaleLinear()
    .domain([0, Math.max(1, ...values)])
    .nice(ticks);
  const [, max] = scale.domain() as [number, number];
  return { max, ticks: scale.ticks(ticks) };
}

interface ColumnChartProps {
  points: { key: string; label: string; value: number; tooltip: string }[];
  /** Axis tick text ("$ 10 mil"). */
  formatTick: (value: number) => string;
}

/** How many x labels fit: a phone's chart, and one from `sm` up ("17 oct" is about 40px). */
export const AXIS_LABELS_NARROW = 4;
export const AXIS_LABELS_WIDE = 8;

/**
 * Which of `count` x labels to print, at most about `max`: every n-th from
 * the first, and the last one too unless it would sit closer than 3/4 of a
 * step to the one before it (where two labels run into each other).
 */
export function axisLabelIndexes(count: number, max: number): Set<number> {
  const shown = new Set<number>();
  if (count <= 0) return shown;
  const every = Math.max(1, Math.ceil(count / Math.max(1, max)));
  for (let index = 0; index < count; index += every) shown.add(index);
  const last = count - 1;
  if (last % every >= (every * 3) / 4) shown.add(last);
  return shown;
}

/**
 * Vertical bars over a time axis (one per day): 2px gaps, 4px rounded tops on
 * the baseline, recessive grid. The x labels thin out on a phone.
 */
export function ColumnChart({ points, formatTick }: ColumnChartProps) {
  const axis = niceAxis(points.map((point) => point.value));
  const wide = axisLabelIndexes(points.length, AXIS_LABELS_WIDE);
  const narrow = axisLabelIndexes(points.length, AXIS_LABELS_NARROW);
  return (
    // Room above the top tick, whose label is centred on the line.
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 pt-3">
      <div className="relative h-48 w-14 text-right text-caption text-fg-muted tabular-nums">
        {axis.ticks.map((tick) => (
          <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(tick / axis.max) * 100}%` }}>
            {formatTick(tick)}
          </span>
        ))}
      </div>
      <div className="relative h-48">
        {axis.ticks.map((tick) => (
          <span key={tick} className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${(tick / axis.max) * 100}%` }} />
        ))}
        <div className="absolute inset-0 flex items-end gap-0.5">
          {points.map((point) => (
            <div key={point.key} className="group relative flex h-full min-w-0 flex-1 items-end">
              {point.value > 0 ? (
                <div className="w-full rounded-t-sm bg-info transition-opacity duration-fast ease-standard group-hover:opacity-80" style={{ height: `${(point.value / axis.max) * 100}%` }} />
              ) : null}
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-fg px-2 py-1 text-caption whitespace-nowrap text-bg shadow-md group-hover:block">
                {point.tooltip}
              </span>
            </div>
          ))}
        </div>
      </div>
      <span />
      <div className="mt-1 flex gap-0.5 border-t border-border-strong pt-1 text-caption text-fg-muted">
        {points.map((point, index) => (
          <span key={point.key} className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">
            {narrow.has(index) ? point.label : wide.has(index) ? <span className="hidden sm:inline">{point.label}</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

interface RankedBarsProps {
  items: { key: string; label: string; value: number; valueLabel: string; detail?: string }[];
}

/** Horizontal bars, biggest first, each labelled with its name and value (direct labels: no legend needed). */
export function RankedBars({ items }: RankedBarsProps) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-label">
            <span className="min-w-0 truncate font-medium text-fg">{item.label}</span>
            <span className="shrink-0 text-fg-secondary tabular-nums">
              {item.valueLabel}
              {item.detail ? <span className="text-fg-muted"> · {item.detail}</span> : null}
            </span>
          </div>
          <div className="h-2.5 rounded-sm bg-bg-muted">
            <div className="h-full rounded-sm bg-info" style={{ width: `${Math.max(1, (item.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
