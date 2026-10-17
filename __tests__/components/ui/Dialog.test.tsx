import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui";

function DialogExample() {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>Abrir</DialogTrigger>
      <DialogContent>
        <DialogTitle>Confirmar</DialogTitle>
        <Button>Aceptar</Button>
      </DialogContent>
    </Dialog>
  );
}

/** Controlled from outside, like CartDrawer / the mobile menu. */
function SheetExample({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir carrito
      </button>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Carrito</SheetTitle>
          </SheetHeader>
          <a href="/cart">Ver carrito</a>
        </SheetContent>
      </Sheet>
    </>
  );
}

describe("Dialog", () => {
  it("opens a labelled modal dialog and moves focus into it", async () => {
    const user = userEvent.setup();
    render(<DialogExample />);

    await user.click(screen.getByRole("button", { name: "Abrir" }));

    const dialog = await screen.findByRole("dialog", { name: "Confirmar" });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<DialogExample />);
    const trigger = screen.getByRole("button", { name: "Abrir" });

    await user.click(trigger);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps Tab focus inside the dialog", async () => {
    const user = userEvent.setup();
    render(<DialogExample />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    const dialog = await screen.findByRole("dialog");

    for (let i = 0; i < 4; i++) {
      await user.tab();
      // Base UI focus guards bounce focus back into the popup asynchronously.
      await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    }
  });
});

describe("Sheet", () => {
  it("is a labelled dialog that closes on Escape and returns focus", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<SheetExample onOpenChange={onOpenChange} />);
    const opener = screen.getByRole("button", { name: "Abrir carrito" });

    await user.click(opener);
    const sheet = await screen.findByRole("dialog", { name: "Carrito" });
    await waitFor(() => expect(sheet).toContainElement(document.activeElement as HTMLElement));

    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("closes with the close button", async () => {
    const user = userEvent.setup();
    render(<SheetExample />);
    await user.click(screen.getByRole("button", { name: "Abrir carrito" }));
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
