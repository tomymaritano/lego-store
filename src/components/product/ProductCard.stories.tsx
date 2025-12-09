import type { Meta, StoryObj } from "@storybook/nextjs";
import { ProductCard } from "./ProductCard";

const meta: Meta<typeof ProductCard> = {
  title: "Product/ProductCard",
  component: ProductCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProductCard>;

const baseProduct = {
  id: "1",
  name: "Captain Rex Helmet",
  price: 899,
  isNew: false,
  isOnSale: false,
  rating: 4.8,
  category: "helmet",
  type: "Sets",
  age: "18+",
  theme: "Star Wars",
  interests: ["Arte", "Robots"],
  pieces: "501-1000",
  highlight: "Destacados",
  img: "https://www.lego.com/cdn/cs/set/assets/bltde62e4576a817dd4/75349.png",
  images: ["https://www.lego.com/cdn/cs/set/assets/bltde62e4576a817dd4/75349.png"],
  stock: 10,
  shortDescription: "Edición limitada para coleccionistas.",
  description: "Star Wars Captain Rex helmet para fanáticos de la saga.",
};

export const Default: Story = {
  args: {
    product: baseProduct,
  },
};

export const New: Story = {
  args: {
    product: {
      ...baseProduct,
      isNew: true,
    },
  },
};

export const OnSale: Story = {
  args: {
    product: {
      ...baseProduct,
      isOnSale: true,
      originalPrice: 999,
    },
  },
};

export const NewAndOnSale: Story = {
  args: {
    product: {
      ...baseProduct,
      isNew: true,
      isOnSale: true,
      originalPrice: 999,
    },
  },
};

export const LimitedEdition: Story = {
  args: {
    product: {
      ...baseProduct,
      highlight: "Edición Limitada",
    },
  },
};

export const Exclusive: Story = {
  args: {
    product: {
      ...baseProduct,
      highlight: "Exclusivos",
    },
  },
};

export const OutOfStock: Story = {
  args: {
    product: {
      ...baseProduct,
      stock: 0,
    },
  },
};

export const WithSecondaryImage: Story = {
  args: {
    product: {
      ...baseProduct,
      imageSecondary: "https://www.lego.com/cdn/cs/set/assets/bltd9dfc1fa25e3b4e8/75349-alt.png",
    },
  },
};
