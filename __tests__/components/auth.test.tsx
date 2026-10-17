import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { PasswordForm } from "@/components/account/PasswordForm";
import { AccountMenu } from "@/components/layout/AccountMenu";
import type { FormState } from "@/lib/auth/form-state";

const usePathname = vi.hoisted(() => vi.fn(() => "/item/1"));
vi.mock("next/navigation", () => ({ usePathname, useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

/** A stand-in Server Action that records what was submitted and answers `result`. */
function stubAction<F extends string>(result: FormState<F>) {
  const submitted: Record<string, string>[] = [];
  const action = vi.fn(async (_state: FormState<F>, formData: FormData) => {
    submitted.push(Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)])));
    return result;
  });
  return { action, submitted };
}

describe("LoginForm", () => {
  it("submits email, password and the callback, then shows the server's answer and keeps the email", async () => {
    const user = userEvent.setup();
    const { action, submitted } = stubAction<"email" | "password">({
      status: "error",
      message: "El email o la contraseña no son correctos.",
      values: { email: "ana@example.com" },
    });
    render(<LoginForm action={action} callbackUrl="/account" />);

    await user.type(screen.getByLabelText(/^Email/), "ana@example.com");
    await user.type(screen.getByLabelText(/^Contraseña/), "mala-clave");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El email o la contraseña no son correctos.");
    expect(submitted[0]).toMatchObject({ email: "ana@example.com", password: "mala-clave", callbackUrl: "/account" });
    expect(screen.getByLabelText(/^Email/)).toHaveValue("ana@example.com");
  });

  it("marks invalid fields, describes them and focuses the first one", async () => {
    const user = userEvent.setup();
    const { action } = stubAction<"email" | "password">({
      status: "error",
      fieldErrors: { email: "Ingresa tu email", password: "Ingresa tu contraseña" },
      values: { email: "" },
    });
    render(<LoginForm action={action} callbackUrl="/" />);
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    const email = screen.getByLabelText(/^Email/);
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "true"));
    expect(email).toHaveAccessibleDescription("Ingresa tu email");
    expect(screen.getByLabelText(/^Contraseña/)).toHaveAccessibleDescription("Ingresa tu contraseña");
    await waitFor(() => expect(email).toHaveFocus());
  });

  it("shows a notice from the URL until the first submission, and Google only when enabled", () => {
    const { action } = stubAction({});
    const { rerender } = render(<LoginForm action={action} callbackUrl="/" notice="Ya existe una cuenta con ese email." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Ya existe una cuenta con ese email.");
    expect(screen.queryByRole("button", { name: "Continuar con Google" })).not.toBeInTheDocument();

    rerender(<LoginForm action={action} callbackUrl="/" googleAction={async () => {}} />);
    expect(screen.getByRole("button", { name: "Continuar con Google" })).toBeInTheDocument();
  });

  it("links to registration, carrying the callback", () => {
    render(<LoginForm action={stubAction({}).action} callbackUrl="/account" />);
    expect(screen.getByRole("link", { name: "Crea una" })).toHaveAttribute("href", "/register?callbackUrl=%2Faccount");
  });

  it("toggles the password visibility with a pressed-state button", async () => {
    const user = userEvent.setup();
    render(<LoginForm action={stubAction({}).action} callbackUrl="/" />);
    const password = screen.getByLabelText(/^Contraseña/);
    const toggle = screen.getByRole("button", { name: "Mostrar contraseña" });
    expect(password).toHaveAttribute("type", "password");
    await user.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });
});

describe("RegisterForm", () => {
  it("submits every field and shows field errors from the server", async () => {
    const user = userEvent.setup();
    const { action, submitted } = stubAction<"name" | "email" | "password" | "confirmPassword">({
      status: "error",
      fieldErrors: { email: "Ya existe una cuenta con ese email. Inicia sesión o usa otro email." },
      values: { name: "Ana", email: "ana@example.com" },
    });
    render(<RegisterForm action={action} callbackUrl="/item/1" />);

    await user.type(screen.getByLabelText(/^Nombre/), "Ana");
    await user.type(screen.getByLabelText(/^Email/), "ana@example.com");
    await user.type(screen.getByLabelText(/^Contraseña/), "bloques-42");
    await user.type(screen.getByLabelText(/^Repite la contraseña/), "bloques-42");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText(/Ya existe una cuenta con ese email/)).toBeInTheDocument();
    expect(submitted[0]).toEqual({
      callbackUrl: "/item/1",
      name: "Ana",
      email: "ana@example.com",
      password: "bloques-42",
      confirmPassword: "bloques-42",
    });
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue("Ana");
    expect(screen.getByRole("link", { name: "Inicia sesión" })).toHaveAttribute("href", "/login?callbackUrl=%2Fitem%2F1");
  });
});

describe("PasswordForm", () => {
  it("shows the confirmation passed by the page after a successful change", () => {
    render(<PasswordForm action={stubAction({}).action} notice="Cambiamos tu contraseña." />);
    expect(screen.getByRole("status")).toHaveTextContent("Cambiamos tu contraseña.");
  });

  it("clears the one-time notice once shown, and keeps showing it when the page refreshes without it", async () => {
    const onNoticeShown = vi.fn(async () => {});
    const action = stubAction({}).action;
    const { rerender } = render(<PasswordForm action={action} notice="Cambiamos tu contraseña." onNoticeShown={onNoticeShown} />);
    await waitFor(() => expect(onNoticeShown).toHaveBeenCalledTimes(1));
    rerender(<PasswordForm action={action} onNoticeShown={onNoticeShown} />);
    expect(screen.getByRole("status")).toHaveTextContent("Cambiamos tu contraseña.");
    expect(onNoticeShown).toHaveBeenCalledTimes(1);
  });

  it("shows a wrong current password on its field", async () => {
    const user = userEvent.setup();
    const { action } = stubAction<"currentPassword">({
      status: "error",
      fieldErrors: { currentPassword: "La contraseña actual no es correcta" },
    });
    render(<PasswordForm action={action} notice="Cambiamos tu contraseña." />);
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
    expect(await screen.findByText("La contraseña actual no es correcta")).toBeInTheDocument();
    // The old confirmation gives way to the new answer.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("AccountMenu", () => {
  const logout = vi.fn(async () => {});

  it("signed out: a login link back to the current page", () => {
    render(<AccountMenu account={null} logoutAction={logout} />);
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/login?callbackUrl=%2Fitem%2F1");
  });

  it("signed in: a disclosure with the account, logout, and no admin link for customers", async () => {
    const user = userEvent.setup();
    render(<AccountMenu account={{ name: "Ana Pérez", email: "ana@example.com", role: "USER" }} logoutAction={logout} />);
    const trigger = screen.getByRole("button", { name: "Tu cuenta (Ana Pérez)" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveTextContent("A");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mi cuenta" })).toHaveAttribute("href", "/account");
    expect(screen.queryByRole("link", { name: "Administración" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toHaveAttribute("type", "submit");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    expect(trigger).toHaveFocus();
  });

  it("admins also get the admin panel; accounts without a name show the email", async () => {
    const user = userEvent.setup();
    render(<AccountMenu account={{ name: null, email: "admin@example.com", role: "ADMIN" }} logoutAction={logout} />);
    await user.click(screen.getByRole("button", { name: "Tu cuenta (admin@example.com)" }));
    expect(screen.getByRole("link", { name: "Administración" })).toHaveAttribute("href", "/admin");
  });
});
