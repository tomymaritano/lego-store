import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./Badge";

const meta = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: { children: "Nuevo", variant: "new" },
  argTypes: {
    variant: {
      control: "select",
      options: ["neutral", "new", "sale", "limited", "exclusive", "success", "warning", "danger"],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function Gallery() {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="neutral">Neutral</Badge>
      <Badge variant="new">Nuevo</Badge>
      <Badge variant="sale">-25%</Badge>
      <Badge variant="limited">Edición limitada</Badge>
      <Badge variant="exclusive">Exclusivo</Badge>
      <Badge variant="success">En stock</Badge>
      <Badge variant="warning">Últimas unidades</Badge>
      <Badge variant="danger">Agotado</Badge>
    </div>
  );
}

export const AllVariants: Story = { render: () => <Gallery /> };
export const AllVariantsDark: Story = { render: () => <Gallery />, globals: { theme: "dark" } };
