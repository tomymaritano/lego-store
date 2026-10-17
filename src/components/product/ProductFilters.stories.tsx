import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { FilterOptions, ProductQuery } from "@/types";
import { ProductFilters } from "./ProductFilters";
import { ActiveFilters } from "./ActiveFilters";
import { removeFilter, withoutFilters } from "@/lib/productQuery";

const options: FilterOptions = {
  categories: [
    { value: "helmet", label: "Helmets", count: 5 },
    { value: "brickheadz", label: "Brickheadz", count: 5 },
    { value: "cars", label: "Vehículos", count: 5 },
  ],
  themes: [
    { value: "Architecture", label: "Architecture", count: 3 },
    { value: "Disney", label: "Disney", count: 1 },
    { value: "Harry Potter", label: "Harry Potter", count: 2 },
    { value: "Marvel", label: "Marvel", count: 3 },
    { value: "Star Wars", label: "Star Wars", count: 9 },
    { value: "Technic", label: "Technic", count: 4 },
  ],
  types: [
    { value: "Decoración del hogar", label: "Decoración del hogar", count: 5 },
    { value: "Sets", label: "Sets", count: 17 },
  ],
  ages: [
    { value: "12+", label: "12+", count: 5 },
    { value: "18+", label: "18+", count: 14 },
  ],
  interests: [],
  pieces: [
    { value: "0-500", label: "0-500", count: 5 },
    { value: "2001+", label: "2001+", count: 9 },
  ],
  highlights: [],
  price: { min: 100, max: 12999 },
  ratings: [
    { value: "4.5", label: "4,5 estrellas o más", count: 17 },
    { value: "4", label: "4 estrellas o más", count: 21 },
  ],
  flags: { onSale: 6, inStock: 22, isNew: 8 },
  total: 22,
};

function Interactive({ initial, showCategories }: { initial: ProductQuery; showCategories?: boolean }) {
  const [query, setQuery] = useState<ProductQuery>(initial);
  return (
    <div className="flex w-72 flex-col gap-6">
      <ActiveFilters
        query={query}
        options={options}
        onRemove={(filter) => setQuery(removeFilter(query, filter))}
        onClear={() => setQuery(withoutFilters(query))}
      />
      <ProductFilters
        options={options}
        query={query}
        onChange={(patch) => setQuery({ ...query, ...patch })}
        showCategories={showCategories}
      />
    </div>
  );
}

const meta: Meta<typeof Interactive> = {
  title: "Product/ProductFilters",
  component: Interactive,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Interactive>;

export const Empty: Story = { args: { initial: {}, showCategories: true } };

export const WithActiveFilters: Story = {
  args: { initial: { onSale: true, themes: ["Star Wars", "Marvel"], minPrice: 500, minRating: 4.5 } },
};

export const Dark: Story = {
  args: { initial: { isNew: true, category: "helmet" }, showCategories: true },
  globals: { theme: "dark" },
};
