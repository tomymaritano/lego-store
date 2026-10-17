import { describe, it, expect } from "vitest";
import { insertAt, positionIn } from "@/stores/restorePosition";

const id = (value: string) => value;

describe("restore positions (undo)", () => {
  it("captures the old index and the id that followed", () => {
    expect(positionIn(["a", "b", "c"], "b")).toEqual({ index: 1, before: "c" });
    expect(positionIn(["a", "b", "c"], "c")).toEqual({ index: 2, before: undefined });
  });

  it("inserts before the old neighbour when it is still there", () => {
    expect(insertAt(["x", "c"], "b", id, { index: 0, before: "c" })).toEqual(["x", "b", "c"]);
  });

  it("falls back to the clamped index, then to the end", () => {
    expect(insertAt(["c"], "a", id, { index: 0, before: "gone" })).toEqual(["a", "c"]);
    expect(insertAt(["a"], "z", id, { index: 9 })).toEqual(["a", "z"]);
    expect(insertAt(["a"], "z", id)).toEqual(["a", "z"]);
  });

  it("keeps the order whichever removal is undone first", () => {
    const start = ["rex", "leia", "cody"];
    const rexAt = positionIn(start, "rex");
    const afterRex = start.filter((x) => x !== "rex");
    const leiaAt = positionIn(afterRex, "leia");
    const empty = afterRex.filter((x) => x !== "leia");

    const rexFirst = insertAt(insertAt(empty, "rex", id, rexAt), "leia", id, leiaAt);
    const leiaFirst = insertAt(insertAt(empty, "leia", id, leiaAt), "rex", id, rexAt);
    expect(rexFirst).toEqual(start);
    expect(leiaFirst).toEqual(start);
  });
});
