import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

const meta = {
  title: "UI/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    icon: <Heart />,
    title: "Todavía no tenés favoritos",
    description: "Guardá los sets que te gustan para encontrarlos rápido.",
    action: <Button render={<Link href="/" />}>Explorar productos</Button>,
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
