import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  Skeleton,
  ProductCardSkeleton,
  ProductListSkeleton,
  ProductDetailSkeleton,
  CartItemSkeleton,
  CategoryHeaderSkeleton,
  FilterSkeleton,
} from "./Skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "UI/Skeleton",
  component: Skeleton,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  args: {
    className: "h-6 w-48",
  },
};

export const Circle: Story = {
  args: {
    className: "h-12 w-12 rounded-full",
  },
};

export const Square: Story = {
  args: {
    className: "h-24 w-24",
  },
};

export const TextLines: Story = {
  render: () => (
    <div className="space-y-2 w-64">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  ),
};

export const ProductCard: Story = {
  render: () => (
    <div className="w-72">
      <ProductCardSkeleton />
    </div>
  ),
};

export const ProductList: Story = {
  render: () => <ProductListSkeleton count={4} />,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="p-8">
        <Story />
      </div>
    ),
  ],
};

export const ProductDetail: Story = {
  render: () => <ProductDetailSkeleton />,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="p-8 max-w-5xl">
        <Story />
      </div>
    ),
  ],
};

export const CartItem: Story = {
  render: () => (
    <div className="w-96">
      <CartItemSkeleton />
      <CartItemSkeleton />
    </div>
  ),
};

export const CategoryHeader: Story = {
  render: () => <CategoryHeaderSkeleton />,
  parameters: {
    layout: "fullscreen",
  },
};

export const Filter: Story = {
  render: () => <FilterSkeleton />,
};
