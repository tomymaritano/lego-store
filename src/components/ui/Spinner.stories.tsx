import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Spinner } from "./Spinner";

const meta = {
  title: "UI/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  args: { className: "size-6 text-fg-muted" },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

function InContext() {
  return (
    <div className="flex items-center gap-3 text-body text-fg" aria-busy="true">
      <Spinner className="size-5 text-fg-muted" />
      <span>Cargando carrito…</span>
    </div>
  );
}

export const WithText: Story = { render: () => <InContext /> };
export const WithTextDark: Story = { render: () => <InContext />, globals: { theme: "dark" } };
