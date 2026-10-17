import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useThemeStore } from "@/stores/themeStore";
import { ThemeToggle } from "./ThemeToggle";

/*
 * The store also writes the theme to <html>, which would fight the Storybook
 * theme toolbar, so stories set only the store's state (no applyTheme).
 */
const withStoreTheme = (theme: "light" | "dark" | "system") => () => {
  useThemeStore.setState({ theme });
  return {};
};

const meta = {
  title: "UI/ThemeToggle",
  component: ThemeToggle,
  tags: ["autodocs"],
  args: { showLabel: true },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = { loaders: [withStoreTheme("light")] };
export const Dark: Story = { loaders: [withStoreTheme("dark")], globals: { theme: "dark" } };
export const System: Story = { loaders: [withStoreTheme("system")] };
export const IconOnly: Story = { args: { showLabel: false }, loaders: [withStoreTheme("light")] };
