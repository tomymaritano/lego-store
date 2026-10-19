import { describe, expect, it } from "vitest";
import { daysOf, MAX_RANGE_DAYS, parseDashboardRange, rangeDays } from "@/lib/validations/dashboard";
import { niceAxis } from "@/components/admin/charts/Charts";

describe("parseDashboardRange", () => {
  const today = "2026-10-18";

  it("defaults to the last 30 days up to today", () => {
    expect(parseDashboardRange({}, today)).toEqual({ from: "2026-09-19", to: "2026-10-18", custom: false });
    expect(rangeDays(parseDashboardRange({}, today))).toBe(30);
  });

  it("swaps a reversed range, caps a long one and ignores invalid dates", () => {
    expect(parseDashboardRange({ from: "2026-10-10", to: "2026-10-01" }, today)).toMatchObject({ from: "2026-10-01", to: "2026-10-10", custom: true });
    const long = parseDashboardRange({ from: "2020-01-01", to: today }, today);
    expect(rangeDays(long)).toBe(MAX_RANGE_DAYS);
    expect(parseDashboardRange({ from: "ayer", to: "2026-13-45" }, today)).toMatchObject({ custom: false });
    expect(parseDashboardRange({ to: "2026-10-05" }, today)).toEqual({ from: "2026-09-06", to: "2026-10-05", custom: true });
  });

  it("lists every day of the range, month boundaries included", () => {
    expect(daysOf({ from: "2026-09-29", to: "2026-10-02" })).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});

describe("niceAxis", () => {
  it("rounds the maximum up to a nice step and keeps an axis for all-zero data", () => {
    expect(niceAxis([1952, 300])).toEqual({ max: 2000, ticks: [0, 500, 1000, 1500, 2000] });
    expect(niceAxis([0, 0]).max).toBe(1);
  });
});
