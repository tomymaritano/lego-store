import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Checkbox } from "./Checkbox";

const meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

function Example() {
  return (
    <div className="flex flex-col gap-4">
      <Checkbox label="Star Wars" defaultChecked />
      <Checkbox label="Marvel" description="42 productos" />
      <Checkbox label="Todos los temas" indeterminate />
      <Checkbox label="Agotados" disabled />
    </div>
  );
}

export const Default: Story = { render: () => <Example /> };
export const Dark: Story = { render: () => <Example />, globals: { theme: "dark" } };
