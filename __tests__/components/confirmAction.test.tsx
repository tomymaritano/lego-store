import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui/Toast", () => ({ showToast: toast, toast: { dismiss: vi.fn() }, Toaster: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { ConfirmAction } = await import("@/components/admin/ConfirmAction");

describe("ConfirmAction", () => {
  it("toasts the result only once the action's transition is done, and closes the dialog", async () => {
    const user = userEvent.setup();
    let finish: (value: { ok: true; message: string }) => void = () => {};
    const action = vi.fn(() => new Promise<{ ok: true; message: string }>((resolve) => (finish = resolve)));
    render(<ConfirmAction label="Bloquear" title="¿Bloquear?" description="Se cierran sus sesiones." confirmLabel="Bloquear cuenta" action={action} testId="block" />);

    await user.click(screen.getByTestId("block"));
    await user.click(screen.getByRole("button", { name: "Bloquear cuenta" }));
    expect(action).toHaveBeenCalledTimes(1);
    // The server has not answered (nor the page refreshed): nothing is announced yet.
    expect(toast.success).not.toHaveBeenCalled();

    await act(async () => finish({ ok: true, message: "Bloqueamos la cuenta." }));
    expect(toast.success).toHaveBeenCalledWith("Bloqueamos la cuenta.");
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("toasts a refusal as an error", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmAction
        label="Bloquear"
        title="¿Bloquear?"
        description="Se cierran sus sesiones."
        confirmLabel="Bloquear cuenta"
        action={async () => ({ ok: false, error: "No puedes bloquearte a ti mismo." })}
        testId="block"
      />
    );
    await user.click(screen.getByTestId("block"));
    await user.click(screen.getByRole("button", { name: "Bloquear cuenta" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("No puedes bloquearte a ti mismo."));
  });
});
