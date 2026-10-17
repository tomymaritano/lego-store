import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./Button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./Dialog";

const meta = {
  title: "UI/Dialog",
  component: Dialog,
  tags: ["autodocs"],
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function Example({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger render={<Button variant="destructive" />}>Vaciar carrito</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Vaciar el carrito?</DialogTitle>
          <DialogDescription>Se van a quitar los 3 productos. Esta acción no se puede deshacer.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>Cancelar</DialogClose>
          <DialogClose render={<Button variant="destructive" />}>Vaciar</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const Default: Story = { render: () => <Example /> };

export const Opened: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Vaciar carrito" }));
    const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: "¿Vaciar el carrito?" });
    // Wait for the enter transition to finish.
    await waitFor(() => expect(dialog).toBeVisible());
  },
};

export const OpenedDark: Story = { ...Opened, globals: { theme: "dark" } };
