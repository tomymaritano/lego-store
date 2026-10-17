import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";
import { Toaster, showToast } from "./Toast";

const meta = {
  title: "UI/Toast",
  component: Toaster,
  tags: ["autodocs"],
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

function Example() {
  return (
    <div className="flex flex-wrap gap-3">
      <Toaster />
      <Button onClick={() => showToast.cart("Casco de Rex agregado al carrito")}>Carrito</Button>
      <Button variant="secondary" onClick={() => showToast.wishlist("Agregado a favoritos", true)}>
        Favoritos
      </Button>
      <Button variant="secondary" onClick={() => showToast.success("Pedido confirmado")}>
        Éxito
      </Button>
      <Button variant="secondary" onClick={() => showToast.error("No se pudo procesar el pago")}>
        Error
      </Button>
      <Button variant="secondary" onClick={() => showToast.warning("Quedan pocas unidades")}>
        Aviso
      </Button>
      <Button variant="secondary" onClick={() => showToast.info("Envío gratis desde $ 50.000")}>
        Info
      </Button>
    </div>
  );
}

export const Default: Story = { render: () => <Example /> };
export const Dark: Story = { render: () => <Example />, globals: { theme: "dark" } };
