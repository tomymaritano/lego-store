import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor, within } from "storybook/test";
import { MobileMenu } from "./MobileMenu";

const noop = () => {};
const logout = async () => {};

const meta = {
  title: "Layout/MobileMenu",
  component: MobileMenu,
  parameters: { nextjs: { navigation: { pathname: "/item/1" } } },
  args: {
    open: true,
    onOpenChange: noop,
    links: [
      { name: "Todos", href: "/" },
      { name: "Star Wars", href: "/category/1" },
      { name: "Technic", href: "/category/2" },
    ],
    themes: [
      { name: "Autos", href: "/search?q=auto" },
      { name: "Castillos", href: "/search?q=castillo" },
    ],
    counts: { cart: 2, wishlist: 1, compare: 0 },
    onOpenCart: noop,
    account: null,
    logoutAction: logout,
  },
} satisfies Meta<typeof MobileMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Waits for the sheet and its staggered groups to finish entering (axe would measure contrast mid-fade). */
const settle =
  (check: (menu: ReturnType<typeof within>) => Promise<void>): Story["play"] =>
  async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: "Menú" });
    await waitFor(() => expect(dialog).toBeVisible());
    const groups = dialog.querySelectorAll("section");
    await waitFor(() => groups.forEach((group) => expect(getComputedStyle(group).opacity).toBe("1")));
    await check(within(dialog));
  };

export const SignedOut: Story = {
  play: settle(async (menu) => {
    await expect(menu.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Crear cuenta" })).toBeVisible();
  }),
};

export const Customer: Story = {
  args: { account: { name: "Ana Pérez", email: "ana@example.com", role: "USER" } },
  play: settle(async (menu) => {
    await expect(menu.getByText("Ana Pérez")).toBeVisible();
    await expect(menu.getByRole("link", { name: "Mi cuenta" })).toHaveAttribute("href", "/account");
    await expect(menu.queryByRole("link", { name: "Administración" })).toBeNull();
    await expect(menu.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  }),
};

export const Admin: Story = {
  args: { account: { name: "Jefa de tienda", email: "admin@example.com", role: "ADMIN" } },
  play: settle(async (menu) => {
    await expect(menu.getByRole("link", { name: "Administración" })).toHaveAttribute("href", "/admin");
  }),
};

export const AdminDark: Story = { ...Admin, globals: { theme: "dark" } };
