import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MAX_COMPARE_ITEMS, useCompareCount, useCompareStore, useIsInCompare } from "@/stores/compareStore";

describe("compareStore", () => {
  beforeEach(() => {
    useCompareStore.setState({ ids: [] });
  });

  it("starts empty", () => {
    expect(useCompareStore.getState().ids).toEqual([]);
  });

  it("adds ids once, in order", () => {
    const { addToCompare } = useCompareStore.getState();
    expect(addToCompare("1")).toBe(true);
    expect(addToCompare("2")).toBe(true);
    expect(addToCompare("1")).toBe(false);
    expect(useCompareStore.getState().ids).toEqual(["1", "2"]);
  });

  it(`holds at most ${MAX_COMPARE_ITEMS} products`, () => {
    const { addToCompare } = useCompareStore.getState();
    ["1", "2", "3", "4"].forEach((id) => addToCompare(id));
    expect(addToCompare("5")).toBe(false);
    expect(useCompareStore.getState().ids).toHaveLength(MAX_COMPARE_ITEMS);
  });

  it("toggle reports added / removed / full", () => {
    const { toggleCompare } = useCompareStore.getState();
    expect(toggleCompare("1")).toBe("added");
    expect(toggleCompare("1")).toBe("removed");
    ["1", "2", "3", "4"].forEach((id) => toggleCompare(id));
    expect(toggleCompare("5")).toBe("full");
  });

  it("removes and clears", () => {
    const { addToCompare, removeFromCompare, clearCompare } = useCompareStore.getState();
    addToCompare("1");
    addToCompare("2");
    removeFromCompare("1");
    expect(useCompareStore.getState().ids).toEqual(["2"]);
    clearCompare();
    expect(useCompareStore.getState().ids).toEqual([]);
  });

  it("selectors follow the store", () => {
    const count = renderHook(() => useCompareCount());
    const inCompare = renderHook(() => useIsInCompare("3"));
    act(() => {
      useCompareStore.getState().addToCompare("3");
    });
    count.rerender();
    inCompare.rerender();
    expect(count.result.current).toBe(1);
    expect(inCompare.result.current).toBe(true);
  });

  it("migrates v0 (full product snapshots) to ids", async () => {
    localStorage.setItem(
      "lego-compare-storage",
      JSON.stringify({
        state: { items: [{ id: "4", name: "Mando" }, { id: "2", name: "Leia" }, { id: "4" }, { nope: true }] },
        version: 0,
      })
    );
    await useCompareStore.persist.rehydrate();
    expect(useCompareStore.getState().ids).toEqual(["4", "2"]);
    expect(JSON.parse(localStorage.getItem("lego-compare-storage")!).state).toEqual({ ids: ["4", "2"] });
  });

  it("removeMany drops stale ids and frees their slots", () => {
    useCompareStore.setState({ ids: ["999", "1", "998", "997"] });
    useCompareStore.getState().removeMany(["999", "998", "997"]);
    expect(useCompareStore.getState().ids).toEqual(["1"]);
    expect(useCompareStore.getState().addToCompare("2")).toBe(true);
  });
});
