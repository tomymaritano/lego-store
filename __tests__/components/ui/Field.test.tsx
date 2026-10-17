import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Field, Input, RadioGroup, RadioGroupItem, Select, SelectTrigger, SelectValue, Slider, Textarea } from "@/components/ui";

describe("Field", () => {
  it("associates the label with the control", () => {
    render(
      <Field label="Nombre">
        <Input />
      </Field>
    );
    const input = screen.getByLabelText("Nombre");
    expect(input.tagName).toBe("INPUT");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("describes the control with the hint", () => {
    render(
      <Field label="Email" hint="Te enviamos el comprobante">
        <Input type="email" />
      </Field>
    );
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Te enviamos el comprobante");
  });

  it("marks the control invalid and describes it with hint and error", () => {
    render(
      <Field label="Email" hint="Usá tu email personal" error="Ingresá un email válido">
        <Input type="email" />
      </Field>
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Usá tu email personal Ingresá un email válido");
    expect(screen.getByRole("alert")).toHaveTextContent("Ingresá un email válido");
  });

  it("keeps the control's own aria-describedby and uses the Field id", () => {
    render(
      <>
        <p id="extra">Extra</p>
        <Field id="custom" label="Comentario" error="Requerido">
          <Textarea aria-describedby="extra" />
        </Field>
      </>
    );
    const textarea = screen.getByLabelText("Comentario");
    expect(textarea).toHaveAttribute("id", "custom");
    expect(textarea.getAttribute("aria-describedby")).toMatch(/^extra /);
    expect(textarea).toHaveAccessibleDescription("Extra Requerido");
  });

  it("propagates required and disabled", () => {
    render(
      <Field label="Ciudad" required disabled>
        <Input />
      </Field>
    );
    const input = screen.getByLabelText(/Ciudad/);
    expect(input).toBeRequired();
    expect(input).toBeDisabled();
  });

  it("gives each field a unique id", () => {
    render(
      <>
        <Field label="Uno">
          <Input />
        </Field>
        <Field label="Dos">
          <Input />
        </Field>
      </>
    );
    expect(screen.getByLabelText("Uno").id).not.toBe(screen.getByLabelText("Dos").id);
  });

  it("labels a RadioGroup via aria-labelledby without a dangling label[for]", () => {
    const { container } = render(
      <Field label="Envío">
        <RadioGroup defaultValue="a">
          <RadioGroupItem value="a" label="Estándar" />
        </RadioGroup>
      </Field>
    );
    expect(screen.getByRole("radiogroup", { name: "Envío" })).toBeInTheDocument();
    expect(container.querySelector("label[for]")).toBeNull();
  });

  it("disables and invalidates a Slider from the Field", () => {
    const { container } = render(
      <Field label="Precio máximo" disabled error="Fuera de rango">
        <Slider defaultValue={50} />
      </Field>
    );
    const slider = screen.getByRole("slider", { name: "Precio máximo" });
    expect(slider).toBeDisabled();
    expect(slider).toHaveAttribute("aria-invalid", "true");
    expect(container.querySelector("label[for]")).toBeNull();
  });

  it("exposes a required RadioGroup to assistive tech", () => {
    render(
      <Field label="Envío" required>
        <RadioGroup defaultValue="a">
          <RadioGroupItem value="a" label="Estándar" />
        </RadioGroup>
      </Field>
    );
    expect(screen.getByRole("radiogroup", { name: "Envío" })).toHaveAttribute("aria-required", "true");
  });

  it("marks a Select trigger required from the Field", () => {
    render(
      <Field label="Provincia" required>
        <Select items={[{ value: "ba", label: "Buenos Aires" }]}>
          <SelectTrigger>
            <SelectValue placeholder="Elegí" />
          </SelectTrigger>
        </Select>
      </Field>
    );
    expect(screen.getByRole("combobox", { name: /Provincia/ })).toHaveAttribute("aria-required", "true");
  });
});
