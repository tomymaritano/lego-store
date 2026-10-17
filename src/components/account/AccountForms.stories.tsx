import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { FormState } from "@/lib/auth/form-state";
import { PasswordForm } from "./PasswordForm";
import { ProfileForm } from "./ProfileForm";

/** /account forms with stand-in Server Actions (see src/app/account/actions.ts for the real ones). */

const answer =
  <F extends string>(state: FormState<F>) =>
  async (): Promise<FormState<F>> =>
    state;

const meta = {
  title: "Account/Forms",
  decorators: [
    (Story) => (
      <div className="max-w-xl space-y-4">
        <h2 id="profile-title" className="text-title">
          Tus datos
        </h2>
        <h2 id="password-title" className="sr-only">
          Contraseña
        </h2>
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Profile: Story = {
  render: () => <ProfileForm action={answer({})} name="Ana Pérez" email="ana@example.com" />,
};

export const Password: Story = {
  render: () => <PasswordForm action={answer({})} />,
};

export const PasswordChanged: Story = {
  render: () => <PasswordForm action={answer({})} notice="Cambiamos tu contraseña. Cerramos la sesión en tus otros dispositivos." />,
};

export const PasswordChangedDark: Story = { ...PasswordChanged, globals: { theme: "dark" } };
