import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Rating, RatingInput } from "@/components/ui";

function Controlled({ onChange }: { onChange?: (v: number) => void }) {
  const [value, setValue] = useState(0);
  return (
    <RatingInput
      label="Tu calificación"
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe("Rating (read-only)", () => {
  it("exposes the value as a single labelled image", () => {
    render(<Rating value={4.3} count={12} />);
    expect(screen.getByRole("img", { name: "Valoración: 4,3 de 5, 12 reseñas" })).toBeInTheDocument();
  });

  it("clamps out-of-range values", () => {
    render(<Rating value={7} />);
    expect(screen.getByRole("img", { name: "Valoración: 5 de 5" })).toBeInTheDocument();
  });
});

describe("RatingInput", () => {
  it("is a labelled group of five named radios", () => {
    render(<Controlled />);
    const group = screen.getByRole("radiogroup", { name: "Tu calificación" });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    expect(screen.getByRole("radio", { name: "1 estrella" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "5 estrellas" })).toBeInTheDocument();
  });

  it("selects a value on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "4 estrellas" }));

    expect(onChange).toHaveBeenLastCalledWith(4);
    expect(screen.getByRole("radio", { name: "4 estrellas" })).toBeChecked();
  });

  it("changes the value with arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "2 estrellas" }));
    await user.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenLastCalledWith(3);
    expect(screen.getByRole("radio", { name: "3 estrellas" })).toHaveFocus();
  });

  it("announces an error and marks the radiogroup invalid", () => {
    render(<RatingInput label="Tu calificación" required value={0} onValueChange={() => {}} error="Elegí una calificación" />);
    const group = screen.getByRole("radiogroup", { name: /Tu calificación/ });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAttribute("aria-required", "true");
    expect(group).toHaveAccessibleDescription("Elegí una calificación");
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAccessibleDescription("Elegí una calificación");
    }
  });
});
