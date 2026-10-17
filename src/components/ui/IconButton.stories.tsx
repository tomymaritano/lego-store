import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Heart, Search, ShoppingCart, X } from "lucide-react";
import { IconButton } from "./IconButton";

const meta = {
  title: "UI/IconButton",
  component: IconButton,
  tags: ["autodocs"],
  args: { label: "Agregar a favoritos", children: <Heart aria-hidden="true" /> },
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "outline", "ghost", "destructive"] },
    size: { control: "select", options: ["icon", "icon-sm"] },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function Gallery() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <IconButton label="Buscar" variant="ghost">
        <Search aria-hidden="true" />
      </IconButton>
      <IconButton label="Ver carrito" variant="primary">
        <ShoppingCart aria-hidden="true" />
      </IconButton>
      <IconButton label="Agregar a favoritos" variant="secondary">
        <Heart aria-hidden="true" />
      </IconButton>
      <IconButton label="Cerrar" variant="outline" size="icon-sm">
        <X aria-hidden="true" />
      </IconButton>
      <IconButton label="Quitar del carrito" variant="destructive">
        <X aria-hidden="true" />
      </IconButton>
      <IconButton label="No disponible" disabled>
        <Heart aria-hidden="true" />
      </IconButton>
      <IconButton label="Disminuir cantidad (límite)" disabled focusableWhenDisabled>
        <X aria-hidden="true" />
      </IconButton>
    </div>
  );
}

export const AllVariants: Story = { render: () => <Gallery /> };
export const AllVariantsDark: Story = { render: () => <Gallery />, globals: { theme: "dark" } };
