import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./Button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "./Sheet";

const meta = {
  title: "UI/Sheet",
  component: Sheet,
  tags: ["autodocs"],
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

function Example({ side = "right" }: { side?: "left" | "right" | "bottom" }) {
  return (
    <Sheet>
      <SheetTrigger render={<Button />}>Abrir panel</SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Carrito (2)</SheetTitle>
          <SheetDescription>Revisá tus productos antes de pagar.</SheetDescription>
        </SheetHeader>
        <SheetBody className="p-4 text-fg-secondary">Contenido del panel.</SheetBody>
        <SheetFooter>
          <Button className="w-full">Finalizar compra</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export const Right: Story = { render: () => <Example /> };
export const Left: Story = { render: () => <Example side="left" /> };
export const Bottom: Story = { render: () => <Example side="bottom" /> };

export const Opened: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir panel" }));
    const sheet = await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: "Carrito (2)" });
    // Wait for the enter transition to finish.
    await waitFor(() => expect(sheet).toBeVisible());
  },
};

export const OpenedDark: Story = { ...Opened, globals: { theme: "dark" } };
