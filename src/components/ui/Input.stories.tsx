import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Search } from "lucide-react";
import { Input, Textarea } from "./Input";

// Standalone controls need a name; inside forms prefer <Field label=...>.
const meta = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  args: { placeholder: "Buscar sets…", "aria-label": "Buscar" },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithIcon: Story = { args: { leftIcon: <Search /> } };
export const Invalid: Story = { args: { invalid: true, defaultValue: "abc" } };
export const Disabled: Story = { args: { disabled: true } };

function Gallery() {
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <Input aria-label="Buscar" placeholder="Buscar sets…" leftIcon={<Search />} />
      <Input aria-label="Email" invalid defaultValue="juan@" />
      <Textarea aria-label="Comentario" placeholder="Cuéntanos tu experiencia" />
    </div>
  );
}

export const AllDark: Story = { render: () => <Gallery />, globals: { theme: "dark" } };
