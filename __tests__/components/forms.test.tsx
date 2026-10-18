import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactForm, NewsletterForm } from "@/components/forms";
import { NEWSLETTER_SIGNUP_DONE } from "@/lib/validations/inbox";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  cart: vi.fn(),
  wishlist: vi.fn(),
}));
vi.mock("@/components/ui/Toast", () => ({ showToast: toast, toast: {}, Toaster: () => null }));
// The Server Actions are the server's (integration tests): here they answer like it would.
const actions = vi.hoisted(() => ({
  sendContactMessageAction: vi.fn(async (input: { email: string }) => ({ ok: true as const, email: input.email.toLowerCase() })),
  subscribeNewsletterAction: vi.fn(async (email: string) => ({ ok: true as const, email, message: "¡Listo!" })),
}));
vi.mock("@/lib/contact/actions", () => actions);

describe("NewsletterForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an invalid email with a described, invalid field", async () => {
    const user = userEvent.setup();
    render(<NewsletterForm />);
    const input = screen.getByLabelText("Tu email");
    await user.type(input, "no-es-un-email");
    await user.click(screen.getByRole("button", { name: "Suscribirse" }));

    expect(await screen.findByText("Ingresa un email válido")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Ingresa un email válido");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("takes its accessible name from the heading it is given (unique landmarks per placement)", () => {
    render(
      <>
        <h2 id="a-title">Suscríbete al newsletter</h2>
        <NewsletterForm labelledBy="a-title" />
        <h2 id="b-title">¿Nuevo en LEGO?</h2>
        <NewsletterForm labelledBy="b-title" />
      </>
    );
    expect(screen.getByRole("form", { name: "Suscríbete al newsletter" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "¿Nuevo en LEGO?" })).toBeInTheDocument();
  });

  it("asks for an email when empty", async () => {
    const user = userEvent.setup();
    render(<NewsletterForm />);
    await user.click(screen.getByRole("button", { name: "Suscribirse" }));
    expect(await screen.findByText("Ingresa tu email")).toBeInTheDocument();
  });

  it("subscribes: success toast, inline confirmation and a cleared field", async () => {
    const user = userEvent.setup();
    render(<NewsletterForm />);
    const input = screen.getByLabelText("Tu email");
    actions.subscribeNewsletterAction.mockResolvedValueOnce({ ok: true, email: "fan@lego.com", message: NEWSLETTER_SIGNUP_DONE });
    await user.type(input, "  fan@lego.com ");
    await user.click(screen.getByRole("button", { name: "Suscribirse" }));

    // The server's answer, true whether the address was new, already in or unsubscribed (nothing says which).
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(NEWSLETTER_SIGNUP_DONE));
    expect(NEWSLETTER_SIGNUP_DONE).not.toMatch(/te sumamos/i);
    expect(actions.subscribeNewsletterAction).toHaveBeenCalledWith("fan@lego.com", "footer");
    expect(screen.getByRole("status")).toHaveTextContent("Recibimos fan@lego.com. Revisa tu correo.");
    expect(input).toHaveValue("");
  });

  it("shows the server's refusal on the field (a rate limit)", async () => {
    actions.subscribeNewsletterAction.mockResolvedValueOnce({ ok: false, error: "Demasiados intentos seguidos." } as never);
    const user = userEvent.setup();
    render(<NewsletterForm />);
    await user.type(screen.getByLabelText("Tu email"), "fan@lego.com");
    await user.click(screen.getByRole("button", { name: "Suscribirse" }));
    expect(await screen.findByText("Demasiados intentos seguidos.")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

// Whole form flows: slow when the full suite runs in parallel.
describe("ContactForm", { timeout: 20_000 }, () => {
  // The validators load on demand (lib/validations/lazy): warm the module once so a
  // busy parallel run does not spend the first test's timeout importing zod.
  beforeAll(async () => {
    await import("@/lib/validations/resolvers");
  });
  beforeEach(() => vi.clearAllMocks());

  it("flags every missing required field on submit", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));

    expect(await screen.findByText("Ingresa tu nombre (al menos 2 caracteres)")).toBeInTheDocument();
    expect(screen.getByText("Ingresa tu email")).toBeInTheDocument();
    expect(screen.getByText("Elige un motivo")).toBeInTheDocument();
    expect(screen.getByText("Cuéntanos un poco más (al menos 20 caracteres)")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre/)).toHaveAttribute("aria-invalid", "true");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("validates the optional order number format", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    await user.type(screen.getByLabelText(/Número de pedido/), "#1");
    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    expect(
      await screen.findByText("El número de pedido tiene entre 4 y 20 letras, números o guiones")
    ).toBeInTheDocument();
  });

  it("sends a valid message and shows the confirmation", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    await user.type(screen.getByLabelText(/Nombre/), "Ana Pérez");
    await user.type(screen.getByLabelText(/^Email/), "ana@example.com");
    await user.click(screen.getByRole("combobox", { name: /Motivo/ }));
    await user.click(await screen.findByRole("option", { name: "Envíos y entregas" }));
    const message = screen.getByLabelText(/Mensaje/);
    // Paste the long text: typing it key by key is what made this test slow under load.
    await user.click(message);
    await user.paste("Quiero saber cuándo llega mi pedido, gracias.");
    expect(message).toHaveAccessibleDescription(/45 \/ 1000 caracteres/);

    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));

    const heading = await screen.findByRole("heading", { name: "¡Mensaje enviado!" });
    expect(heading).toHaveFocus();
    expect(actions.sendContactMessageAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ana Pérez", email: "ana@example.com", topic: "envio", website: "" })
    );
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Enviar otro mensaje" }));
    expect(await screen.findByRole("button", { name: "Enviar mensaje" })).toBeInTheDocument();
  });

  it("puts the server's field errors on their fields and shows a refusal", async () => {
    actions.sendContactMessageAction.mockResolvedValueOnce({ ok: false, error: "Enviaste demasiados mensajes seguidos." } as never);
    const user = userEvent.setup();
    render(<ContactForm />);
    await user.type(screen.getByLabelText(/Nombre/), "Ana Pérez");
    await user.type(screen.getByLabelText(/^Email/), "ana@example.com");
    await user.click(screen.getByRole("combobox", { name: /Motivo/ }));
    await user.click(await screen.findByRole("option", { name: "Otro motivo" }));
    await user.click(screen.getByLabelText(/Mensaje/));
    await user.paste("Un mensaje lo bastante largo para pasar.");
    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enviaste demasiados mensajes seguidos.");
    expect(toast.success).not.toHaveBeenCalled();
  });
});
