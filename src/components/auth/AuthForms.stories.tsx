import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import type { FormState } from "@/lib/auth/form-state";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

/*
 * The account forms with stand-in Server Actions (the real ones live in
 * src/app/(auth)/actions.ts and need a database). Each story's action
 * answers the way the server does for that case.
 */

const answer =
  <F extends string>(state: FormState<F>) =>
  async (): Promise<FormState<F>> =>
    state;

const meta = {
  title: "Auth/Forms",
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-[28rem] max-w-full">
        <h1 id="auth-title" className="mb-6 text-headline">
          Cuenta
        </h1>
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Login: Story = {
  render: () => <LoginForm action={answer({})} callbackUrl="/account" />,
};

export const LoginWithGoogle: Story = {
  render: () => <LoginForm action={answer({})} callbackUrl="/" googleAction={async () => {}} />,
};

export const LoginWrongPassword: Story = {
  render: () => (
    <LoginForm
      action={answer<"email" | "password">({
        status: "error",
        message: "El email o la contraseña no son correctos.",
        values: { email: "ana@example.com" },
      })}
      callbackUrl="/"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Iniciar sesión" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("El email o la contraseña no son correctos.");
  },
};

export const Register: Story = {
  render: () => <RegisterForm action={answer({})} callbackUrl="/" />,
};

export const RegisterInvalid: Story = {
  render: () => (
    <RegisterForm
      action={answer<"name" | "email" | "password" | "confirmPassword">({
        status: "error",
        fieldErrors: {
          name: "Ingresa tu nombre (al menos 2 caracteres)",
          email: "Ya existe una cuenta con ese email. Inicia sesión o usa otro email.",
          password: "La contraseña tiene que tener al menos 8 caracteres",
          confirmPassword: "Las contraseñas no coinciden",
        },
        values: { name: "A", email: "ana@example.com" },
      })}
      callbackUrl="/"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Crear cuenta" }));
    await expect(await canvas.findByText("Las contraseñas no coinciden")).toBeVisible();
  },
};

export const RegisterInvalidDark: Story = { ...RegisterInvalid, globals: { theme: "dark" } };
