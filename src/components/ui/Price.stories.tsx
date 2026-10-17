import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Price } from "./Price";

const meta = {
  title: "UI/Price",
  component: Price,
  tags: ["autodocs"],
  args: { value: 89999, originalValue: 119999, showDiscount: true, size: "md" },
} satisfies Meta<typeof Price>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Discounted: Story = {};

function Gallery() {
  return (
    <div className="flex flex-col gap-4">
      <Price value={45999} size="sm" />
      <Price value={89999} originalValue={119999} />
      <Price value={89999} originalValue={119999} showDiscount size="lg" />
    </div>
  );
}

export const Sizes: Story = { render: () => <Gallery /> };
export const SizesDark: Story = { render: () => <Gallery />, globals: { theme: "dark" } };
