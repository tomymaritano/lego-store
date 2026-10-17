import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useThemeStore } from "@/stores/themeStore";
import { ThemeToggle } from "./ThemeToggle";

/*
 * The store never touches <html> (ThemeSync does, and it is not mounted here),
 * so the Storybook theme toolbar stays in charge. Loaders hydrate the store
 * (the app does it in StoreHydrator) and then set the state under test.
 */
const withStoreTheme = (theme: "light" | "dark" | "system") => async () => {
  await useThemeStore.persist.rehydrate();
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
