import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProductCardSkeleton, ProductListSkeleton, Skeleton } from "./Skeleton";

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
    <div className="max-w-5xl space-y-6" aria-busy="true">
      <div className="max-w-xs">
        <ProductCardSkeleton />
      </div>
      <ProductListSkeleton count={4} />
    </div>
  );
}

export const Compositions: Story = { render: () => <Gallery /> };
export const CompositionsDark: Story = { render: () => <Gallery />, globals: { theme: "dark" } };
