import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

const meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Agregar al carrito" },
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "outline", "ghost", "destructive", "link"] },
    size: { control: "select", options: ["sm", "md", "lg"] },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function Gallery() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button>Primario</Button>
        <Button variant="secondary">Secundario</Button>
        <Button variant="outline">Contorno</Button>
        <Button variant="ghost">Fantasma</Button>
        <Button variant="destructive">
          <Trash2 aria-hidden="true" />
          Eliminar
        </Button>
        <Button variant="link">Enlace</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm">Chico</Button>
        <Button size="md">Mediano</Button>
        <Button size="lg">
          <ShoppingCart aria-hidden="true" />
          Grande
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button loading>Procesando</Button>
        <Button disabled>Deshabilitado</Button>
        <Button render={<Link href="/cart" />}>Ver carrito (enlace)</Button>
        <IconButton label="Agregar a favoritos">
          <Heart aria-hidden="true" />
        </IconButton>
        <IconButton label="Eliminar" variant="secondary" size="icon-sm">
          <Trash2 aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  );
}

export const Variants: Story = { render: () => <Gallery /> };
export const VariantsDark: Story = { render: () => <Gallery />, globals: { theme: "dark" } };
