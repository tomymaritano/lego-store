import type { Meta, StoryObj } from "@storybook/nextjs";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "new", "sale", "limited", "exclusive", "success", "warning"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: "Default",
    variant: "default",
  },
};

export const New: Story = {
  args: {
    children: "Nuevo",
    variant: "new",
  },
};

export const Sale: Story = {
  args: {
    children: "-20%",
    variant: "sale",
  },
};

export const Limited: Story = {
  args: {
    children: "Edición Limitada",
    variant: "limited",
  },
};

export const Exclusive: Story = {
  args: {
    children: "Exclusivo",
    variant: "exclusive",
  },
};

export const Success: Story = {
  args: {
    children: "Disponible",
    variant: "success",
  },
};

export const Warning: Story = {
  args: {
    children: "Últimas unidades",
    variant: "warning",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge variant="default">Default</Badge>
      <Badge variant="new">Nuevo</Badge>
      <Badge variant="sale">-20%</Badge>
      <Badge variant="limited">Edición Limitada</Badge>
      <Badge variant="exclusive">Exclusivo</Badge>
      <Badge variant="success">Disponible</Badge>
      <Badge variant="warning">Últimas unidades</Badge>
    </div>
  ),
};
