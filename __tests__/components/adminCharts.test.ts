import { describe, expect, it } from "vitest";
import { AXIS_LABELS_NARROW, AXIS_LABELS_WIDE, axisLabelIndexes } from "@/components/admin/charts/Charts";

const indexes = (count: number, max: number) => [...axisLabelIndexes(count, max)].sort((a, b) => a - b);

describe("axisLabelIndexes", () => {
  it("prints every label when they fit", () => {
    expect(indexes(7, AXIS_LABELS_WIDE)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(indexes(0, AXIS_LABELS_WIDE)).toEqual([]);
    expect(indexes(1, AXIS_LABELS_NARROW)).toEqual([0]);
  });

  it("never prints two labels side by side (30 days: no '17 oct18 oct')", () => {
    for (const max of [AXIS_LABELS_NARROW, AXIS_LABELS_WIDE]) {
      for (let count = 2; count <= 120; count++) {
        const shown = indexes(count, max);
        const every = Math.ceil(count / max);
        for (let i = 1; i < shown.length; i++) expect(shown[i]! - shown[i - 1]!).toBeGreaterThanOrEqual(Math.max(1, Math.ceil((every * 3) / 4)));
        expect(shown.length).toBeLessThanOrEqual(max + 1);
        expect(shown[0]).toBe(0);
      }
    }
    expect(indexes(30, AXIS_LABELS_WIDE)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
  });

  it("keeps the last day when there is room for it", () => {
    expect(indexes(31, AXIS_LABELS_WIDE)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(indexes(15, AXIS_LABELS_WIDE)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(indexes(30, AXIS_LABELS_NARROW)).toEqual([0, 8, 16, 24]);
    expect(indexes(28, AXIS_LABELS_NARROW)).toEqual([0, 7, 14, 21, 27]);
  });
});
