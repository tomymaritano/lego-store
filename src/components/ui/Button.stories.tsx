import type { Meta, StoryObj } from "@storybook/nextjs";
import { Button } from "./Button";
import { ShoppingCart, Heart } from "lucide-react";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "outline", "ghost", "danger"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "icon"],
    },
    isLoading: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    children: "Agregar al carrito",
    variant: "primary",
    size: "md",
  },
};

export const Secondary: Story = {
  args: {
    children: "Cancelar",
    variant: "secondary",
    size: "md",
  },
};

export const Outline: Story = {
  args: {
    children: "Ver más",
    variant: "outline",
    size: "md",
  },
};

export const Ghost: Story = {
  args: {
    children: "Enlace",
    variant: "ghost",
    size: "md",
  },
};

export const Danger: Story = {
  args: {
    children: "Eliminar",
    variant: "danger",
    size: "md",
  },
};

export const Small: Story = {
  args: {
    children: "Pequeño",
    variant: "primary",
    size: "sm",
  },
};

export const Large: Story = {
  args: {
    children: "Grande",
    variant: "primary",
    size: "lg",
  },
};

export const Loading: Story = {
  args: {
    children: "Cargando...",
    variant: "primary",
    isLoading: true,
  },
};

export const Disabled: Story = {
  args: {
    children: "Deshabilitado",
    variant: "primary",
    disabled: true,
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <ShoppingCart className="w-4 h-4 mr-2" />
        Agregar al carrito
      </>
    ),
    variant: "primary",
  },
};

export const IconButton: Story = {
  args: {
    children: <Heart className="w-5 h-5" />,
    variant: "ghost",
    size: "icon",
    "aria-label": "Favorito",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">
        <Heart className="w-5 h-5" />
      </Button>
    </div>
  ),
};
