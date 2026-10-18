import { dateParam, first, type SearchParams } from "./admin";

/*
 * The dashboard's date range (/admin?from=…&to=…): store calendar days,
 * inclusive. Default: the last 30 days up to today. At most MAX_RANGE_DAYS;
 * a reversed range is swapped; anything invalid falls back to the default.
 */

export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;

export interface DashboardRange {
  from: string;
  to: string;
  /** Whether the admin chose it (the page offers "Últimos 30 días" back). */
  custom: boolean;
}

const DAY = 24 * 60 * 60 * 1000;
const day = (date: string) => Date.parse(`${date}T00:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Calendar days from `from` to `to`, both included. */
export const rangeDays = (range: Pick<DashboardRange, "from" | "to">) => Math.round((day(range.to) - day(range.from)) / DAY) + 1;

/** `today` is the store's calendar date (storeDate(now)). */
export function parseDashboardRange(params: SearchParams, today: string, defaultDays = DEFAULT_RANGE_DAYS): DashboardRange {
  let from = dateParam(first(params.from));
  let to = dateParam(first(params.to));
  const fallback = { from: iso(day(today) - (defaultDays - 1) * DAY), to: today, custom: false };
  if (!from && !to) return fallback;
  to ||= today;
  from ||= iso(day(to) - (defaultDays - 1) * DAY);
  if (day(from) > day(to)) [from, to] = [to, from];
  if (rangeDays({ from, to }) > MAX_RANGE_DAYS) from = iso(day(to) - (MAX_RANGE_DAYS - 1) * DAY);
  return { from, to, custom: true };
}

/** Every calendar day of the range, in order ("2026-10-01", …). */
export function daysOf(range: Pick<DashboardRange, "from" | "to">): string[] {
  const days: string[] = [];
  for (let at = day(range.from); at <= day(range.to); at += DAY) days.push(iso(at));
  return days;
}
