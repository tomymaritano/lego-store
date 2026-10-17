import Link from "next/link";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Button, IconButton } from "@/components/ui";

describe("Button", () => {
  it("renders a native button by default", () => {
    render(<Button>Agregar</Button>);
    const button = screen.getByRole("button", { name: "Agregar" });
    expect(button.tagName).toBe("BUTTON");
  });

  it("renders as a link without nesting a button", () => {
    render(<Button render={<Link href="/cart" />}>Ver carrito</Button>);

    const link = screen.getByRole("link", { name: "Ver carrito" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/cart");
    expect(link.querySelector("button")).toBeNull();
    expect(link.closest("button")).toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is disabled and busy while loading", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Pagar
      </Button>
    );
    const button = screen.getByRole("button", { name: "Pagar" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("makes a disabled link-button inert (no focus, no click, no Enter)", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <Button render={<a href="#pagar" />} disabled onClick={onClick}>
          Pagar
        </Button>
        <button type="button">Después</button>
      </>
    );
    const link = screen.getByRole("link", { name: "Pagar" });
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("tabindex", "-1");

    await user.tab();
    expect(screen.getByRole("button", { name: "Después" })).toHaveFocus();

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("IconButton", () => {
  it("uses the required label as accessible name", () => {
    render(
      <IconButton label="Cerrar menú">
        <svg aria-hidden="true" />
      </IconButton>
    );
    expect(screen.getByRole("button", { name: "Cerrar menú" })).toBeInTheDocument();
  });
});
