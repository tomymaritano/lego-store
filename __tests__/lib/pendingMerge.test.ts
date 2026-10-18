import { afterEach, describe, expect, it } from "vitest";
import { isPendingMerge, readPendingMerge, writePendingMerge } from "@/lib/lists/pending-merge";
import { MAX_LINE_QUANTITY, MAX_LIST_ITEMS, mergeListsSchema } from "@/lib/validations/lists";

const valid = {
  token: "0123456789abcdef-token",
  cart: [{ productId: "17", quantity: 2 }],
  wishlist: ["3", "9"],
};

const samples: unknown[] = [
  valid,
  { ...valid, cart: [], wishlist: [] },
  { ...valid, token: "short" },
  { ...valid, token: "has spaces in the token!!" },
  { ...valid, cart: [{ productId: "17", quantity: 0 }] },
  { ...valid, cart: [{ productId: "17", quantity: 1.5 }] },
  { ...valid, cart: [{ productId: "17", quantity: MAX_LINE_QUANTITY + 1 }] },
  { ...valid, cart: [{ productId: "", quantity: 1 }] },
  { ...valid, cart: [{ productId: "   ", quantity: 1 }] },
  { ...valid, cart: [{ productId: "x".repeat(65), quantity: 1 }] },
  { ...valid, cart: [{ quantity: 1 }] },
  { ...valid, cart: [null] },
  { ...valid, wishlist: [3] },
  { ...valid, wishlist: Array.from({ length: MAX_LIST_ITEMS + 1 }, (_, i) => String(i)) },
  { ...valid, cart: "nope" },
  { token: valid.token, cart: [] },
  null,
  "string",
  42,
];

describe("isPendingMerge", () => {
  it.each(samples.map((sample, index) => [index, sample]))("agrees with mergeListsSchema (sample %i)", (_, sample) => {
    expect(isPendingMerge(sample)).toBe(mergeListsSchema.safeParse(sample).success);
  });
});

describe("readPendingMerge", () => {
  afterEach(() => window.localStorage.clear());

  it("round-trips a written merge", () => {
    writePendingMerge(valid);
    expect(readPendingMerge()).toEqual(valid);
  });

  it("drops a corrupt stored value", () => {
    window.localStorage.setItem("lego-lists-merge", JSON.stringify({ token: "x", cart: [], wishlist: [] }));
    expect(readPendingMerge()).toBeNull();
  });
});
