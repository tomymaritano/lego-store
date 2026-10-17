import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CartItemSkeleton, ProductCardSkeleton, Skeleton } from "./Skeleton";

const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  args: { className: "h-6 w-48" },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

function Gallery() {
  return (
    <div className="grid max-w-3xl gap-6 sm:grid-cols-2" aria-busy="true">
      <ProductCardSkeleton />
      <div className="rounded-2xl border border-border">
        <CartItemSkeleton />
      </div>
    </div>
  );
}

export const Compositions: Story = { render: () => <Gallery /> };
export const CompositionsDark: Story = { render: () => <Gallery />, globals: { theme: "dark" } };
