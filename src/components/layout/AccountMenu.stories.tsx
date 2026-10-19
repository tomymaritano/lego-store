import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AccountMenu } from "./AccountMenu";

const logout = async () => {};

const meta = {
  title: "Layout/AccountMenu",
  component: AccountMenu,
  parameters: { nextjs: { navigation: { pathname: "/item/1" } } },
  args: { account: null, logoutAction: logout },
  decorators: [
    (Story) => (
      <div className="flex h-72 justify-end">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedOut: Story = {};

/** Opens the menu and waits for its drop-in to finish (axe would measure contrast mid-fade). */
const openMenu: Story["play"] = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const trigger = canvas.getByRole("button", { name: /^Tu cuenta/ });
  await userEvent.click(trigger);
  const panel = canvasElement.ownerDocument.getElementById(trigger.getAttribute("aria-controls")!)!;
  await waitFor(() => expect(getComputedStyle(panel).opacity).toBe("1"));
  await expect(canvas.getByRole("link", { name: "Mi cuenta" })).toBeVisible();
};

export const Customer: Story = {
  args: { account: { name: "Ana Pérez", email: "ana@example.com", role: "USER" } },
  play: openMenu,
};

export const Admin: Story = {
  args: { account: { name: "Jefa de tienda", email: "admin@example.com", role: "ADMIN" } },
  play: openMenu,
};

export const AdminDark: Story = { ...Admin, globals: { theme: "dark" } };
