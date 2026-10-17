import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Field } from "./Field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";

const options = [
  { value: "relevance", label: "Relevancia" },
  { value: "price-asc", label: "Precio: menor a mayor" },
  { value: "price-desc", label: "Precio: mayor a menor" },
  { value: "rating", label: "Mejor valorados" },
];

const meta = {
  title: "UI/Select",
  component: Select,
  tags: ["autodocs"],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

function Example() {
  return (
    <div className="flex max-w-xs flex-col gap-5">
      <Field label="Ordenar por">
        <Select items={options} defaultValue="relevance">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Provincia" error="Elige una provincia">
        <Select items={[{ value: "ba", label: "Buenos Aires" }]}>
          <SelectTrigger>
            <SelectValue placeholder="Elige una opción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ba">Buenos Aires</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

export const Default: Story = { render: () => <Example /> };
export const Dark: Story = { render: () => <Example />, globals: { theme: "dark" } };

export const Open: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox", { name: "Ordenar por" }));
    const body = within(canvasElement.ownerDocument.body);
    const option = await body.findByRole("option", { name: "Mejor valorados" });
    await waitFor(() => expect(option).toBeVisible());
  },
};
