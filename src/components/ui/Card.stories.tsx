import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./Card";

const meta = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

function Example() {
  return (
    <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Resumen del pedido</CardTitle>
          <CardDescription>2 productos</CardDescription>
        </CardHeader>
        <CardContent className="text-fg-secondary">Envío gratis en compras mayores a $ 50.000.</CardContent>
        <CardFooter>
          <Button className="w-full">Continuar al pago</Button>
        </CardFooter>
      </Card>
      <Card interactive elevation="flat">
        <CardHeader>
          <CardTitle>Tarjeta interactiva</CardTitle>
          <CardDescription>Se eleva al pasar el mouse.</CardDescription>
        </CardHeader>
        <CardContent className="text-fg-secondary">Usala para cards clickeables.</CardContent>
      </Card>
    </div>
  );
}

export const Default: Story = { render: () => <Example /> };
export const Dark: Story = { render: () => <Example />, globals: { theme: "dark" } };
