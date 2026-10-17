import { describe, it, expect } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useScrollEdges } from "@/hooks/useScrollEdges";

function Scroller({ axis }: { axis: "x" | "y" }) {
  const [ref, edges] = useScrollEdges<HTMLDivElement>(axis);
  return (
    <div ref={ref} data-testid="scroller" data-start={String(edges.start)} data-end={String(edges.end)}>
      <div />
    </div>
  );
}

/** jsdom has no layout: give the scroller fixed scroll metrics. */
function setMetrics(el: HTMLElement, metrics: Record<string, number>) {
  for (const [key, value] of Object.entries(metrics)) {
    Object.defineProperty(el, key, { configurable: true, writable: true, value });
  }
}

describe("useScrollEdges", () => {
  it("tracks the top and bottom edges of a vertical scroller", () => {
    const { rerender } = render(<Scroller axis="y" />);
    const el = screen.getByTestId("scroller");
    setMetrics(el, { scrollHeight: 1000, clientHeight: 600, scrollTop: 0 });
    act(() => {
      el.dispatchEvent(new Event("scroll"));
    });
    rerender(<Scroller axis="y" />);
    expect(el).toHaveAttribute("data-start", "false");
    expect(el).toHaveAttribute("data-end", "true");

    setMetrics(el, { scrollTop: 400 });
    act(() => {
      el.dispatchEvent(new Event("scroll"));
    });
    expect(el).toHaveAttribute("data-start", "true");
    expect(el).toHaveAttribute("data-end", "false");
  });

  it("ignores vertical overflow on a horizontal scroller", () => {
    render(<Scroller axis="x" />);
    const el = screen.getByTestId("scroller");
    setMetrics(el, { scrollHeight: 1000, clientHeight: 600, scrollTop: 100, scrollWidth: 300, clientWidth: 300, scrollLeft: 0 });
    act(() => {
      el.dispatchEvent(new Event("scroll"));
    });
    expect(el).toHaveAttribute("data-start", "false");
    expect(el).toHaveAttribute("data-end", "false");
  });
});
