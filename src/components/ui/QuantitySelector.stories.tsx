import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { QuantitySelector } from "./QuantitySelector";

const meta = {
  title: "UI/QuantitySelector",
  component: QuantitySelector,
  tags: ["autodocs"],
  args: { value: 1, onValueChange: () => {} },
} satisfies Meta<typeof QuantitySelector>;

export default meta;
type Story = StoryObj<typeof meta>;

function Example() {
  const [a, setA] = useState(1);
  const [b, setB] = useState(3);
  return (
    <div className="flex flex-col items-start gap-4">
      <QuantitySelector value={a} onValueChange={setA} max={5} label="Cantidad de Casco de Rex" />
      <QuantitySelector value={b} onValueChange={setB} max={3} size="sm" label="Cantidad de Halcón Milenario" />
    </div>
  );
}

export const Default: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    const group = within(within(canvasElement).getByRole("group", { name: "Cantidad de Casco de Rex" }));
    await userEvent.click(group.getByRole("button", { name: "Aumentar cantidad" }));
    await expect(group.getByRole("status")).toHaveTextContent("2");
  },
};
export const Dark: Story = { render: () => <Example />, globals: { theme: "dark" } };
