import { describe, it, expect, beforeEach } from "vitest";
import { MAX_RECENTLY_VIEWED, useRecentlyViewedStore } from "@/stores/recentlyViewedStore";

describe("recentlyViewedStore", () => {
  beforeEach(() => {
    useRecentlyViewedStore.setState({ ids: [] });
  });

  it("puts the latest product first", () => {
    const { addItem } = useRecentlyViewedStore.getState();
    addItem("1");
    addItem("2");
    expect(useRecentlyViewedStore.getState().ids).toEqual(["2", "1"]);
  });

  it("moves a revisited product to the front without duplicating it", () => {
    const { addItem } = useRecentlyViewedStore.getState();
    addItem("1");
    addItem("2");
    addItem("1");
    expect(useRecentlyViewedStore.getState().ids).toEqual(["1", "2"]);
  });

  it(`keeps the last ${MAX_RECENTLY_VIEWED}`, () => {
    const { addItem } = useRecentlyViewedStore.getState();
    for (let i = 1; i <= MAX_RECENTLY_VIEWED + 3; i++) addItem(String(i));
    const ids = useRecentlyViewedStore.getState().ids;
    expect(ids).toHaveLength(MAX_RECENTLY_VIEWED);
    expect(ids[0]).toBe(String(MAX_RECENTLY_VIEWED + 3));
  });

  it("clears", () => {
    useRecentlyViewedStore.getState().addItem("1");
    useRecentlyViewedStore.getState().clearAll();
    expect(useRecentlyViewedStore.getState().ids).toEqual([]);
  });

  it("migrates v0 (full products) to ids", async () => {
    localStorage.setItem(
      "lego-recently-viewed",
      JSON.stringify({ state: { items: [{ id: "7", name: "Batmobile" }, { id: "1" }] }, version: 0 })
    );
    await useRecentlyViewedStore.persist.rehydrate();
    expect(useRecentlyViewedStore.getState().ids).toEqual(["7", "1"]);
  });
});
