import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it.each([
    [["duration-fast", "duration-base"], "duration-base"],
    [["duration-200", "duration-fast"], "duration-fast"],
    [["duration-slow", "duration-150"], "duration-150"],
    [["ease-standard", "ease-emphasized"], "ease-emphasized"],
    [["ease-in", "ease-standard"], "ease-standard"],
    [["ease-exit", "ease-linear"], "ease-linear"],
    [["animate-shimmer", "animate-none"], "animate-none"],
    [["animate-spin", "animate-shimmer"], "animate-shimmer"],
    [["shadow-sm", "shadow-card"], "shadow-card"],
    [["text-sm", "text-body"], "text-body"],
  ])("resolves %j to %s", (inputs, expected) => {
    expect(cn(...inputs)).toBe(expected);
  });

  it("keeps a size token and a colour token together", () => {
    expect(cn("text-label", "text-fg")).toBe("text-label text-fg");
    expect(cn("text-display", "text-fg-muted")).toBe("text-display text-fg-muted");
  });
});
