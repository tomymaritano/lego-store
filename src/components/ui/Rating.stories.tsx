import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Rating, RatingInput } from "./Rating";

const meta = {
  title: "UI/Rating",
  component: Rating,
  tags: ["autodocs"],
  args: { value: 4.3, count: 86, showValue: true },
} satisfies Meta<typeof Rating>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadOnly: Story = {};

/** A product nobody reviewed yet. */
export const NoReviews: Story = { args: { value: 0, count: 0 } };

function InputExample() {
  const [value, setValue] = useState(0);
  return (
    <div className="flex flex-col gap-6">
      <Rating value={4.3} count={86} showValue />
      <Rating value={2.5} size="sm" />
      <RatingInput label="Tu calificación" value={value} onValueChange={setValue} required />
      <RatingInput label="Con error" value={0} onValueChange={() => {}} error="Elige una calificación" />
    </div>
  );
}

export const Interactive: Story = { render: () => <InputExample /> };
export const InteractiveDark: Story = { render: () => <InputExample />, globals: { theme: "dark" } };
