import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Field } from "./Field";
import { RadioGroup, RadioGroupItem } from "./RadioGroup";

const meta = {
  title: "UI/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

function Example() {
  return (
    <Field label="Método de envío" hint="El envío express llega en 24 h">
      <RadioGroup defaultValue="standard">
        <RadioGroupItem value="standard" label="Estándar" description="3 a 5 días hábiles · Gratis" />
        <RadioGroupItem value="express" label="Express" description="24 h · $ 4.500" />
        <RadioGroupItem value="pickup" label="Retiro en tienda" disabled />
      </RadioGroup>
    </Field>
  );
}

export const Default: Story = { render: () => <Example /> };
export const Dark: Story = { render: () => <Example />, globals: { theme: "dark" } };
