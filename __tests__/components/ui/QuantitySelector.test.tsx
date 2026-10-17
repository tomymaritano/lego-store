import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { QuantitySelector } from "@/components/ui";

function Controlled({ initial = 1, min, max }: { initial?: number; min?: number; max?: number }) {
  const [value, setValue] = useState(initial);
  return <QuantitySelector value={value} onValueChange={setValue} min={min} max={max} label="Cantidad de Casco" />;
}

describe("QuantitySelector", () => {
  it("is a named group with labelled buttons", () => {
    render(<Controlled />);
    expect(screen.getByRole("group", { name: "Cantidad de Casco" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disminuir cantidad" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aumentar cantidad" })).toBeInTheDocument();
  });

  it("marks decrement aria-disabled at the minimum (still focusable)", () => {
    render(<Controlled initial={1} min={1} />);
    const decrement = screen.getByRole("button", { name: "Disminuir cantidad" });
    expect(decrement).toHaveAttribute("aria-disabled", "true");
    expect(decrement).not.toHaveAttribute("disabled");
    expect(screen.getByRole("button", { name: "Aumentar cantidad" })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("increments up to max and then disables increment", async () => {
    const user = userEvent.setup();
    render(<Controlled initial={2} max={3} />);
    const increment = screen.getByRole("button", { name: "Aumentar cantidad" });

    await user.click(increment);
    expect(screen.getByRole("status")).toHaveTextContent(/^3$/);
    expect(increment).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps keyboard focus on the button when it reaches the bound", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    function Spy() {
      const [value, setValue] = useState(4);
      return (
        <QuantitySelector
          value={value}
          onValueChange={(v) => {
            onValueChange(v);
            setValue(v);
          }}
          max={5}
        />
      );
    }
    render(<Spy />);
    const increment = screen.getByRole("button", { name: "Aumentar cantidad" });
    increment.focus();
    await user.keyboard("{Enter}");
    expect(increment).toHaveAttribute("aria-disabled", "true");
    expect(increment).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent(/^5$/);
  });

  it("never emits values outside the bounds", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    // Out-of-range value from outside (e.g. stock dropped): next step is clamped.
    render(<QuantitySelector value={10} onValueChange={onValueChange} min={1} max={5} />);

    await user.click(screen.getByRole("button", { name: "Disminuir cantidad" }));
    expect(onValueChange).toHaveBeenCalledWith(5);
  });
});
