import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { formatPrice } from "@/lib/utils";
import { Field } from "./Field";
import { Slider } from "./Slider";

const meta = {
  title: "UI/Slider",
  component: Slider,
  tags: ["autodocs"],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

function Example() {
  return (
    <div className="flex max-w-sm flex-col gap-8">
      <Field label="Precio">
        <Slider
          defaultValue={[20000, 150000]}
          min={0}
          max={200000}
          step={5000}
          thumbLabels={["Precio mínimo", "Precio máximo"]}
          formatValueText={formatPrice}
        />
      </Field>
      <Field label="Edad mínima">
        <Slider defaultValue={8} min={4} max={18} />
      </Field>
    </div>
  );
}

export const Default: Story = { render: () => <Example /> };
export const Dark: Story = { render: () => <Example />, globals: { theme: "dark" } };
