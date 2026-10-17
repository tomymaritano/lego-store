import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

const meta = {
  title: "UI/Tabs",
  component: Tabs,
  tags: ["autodocs"],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

function Example() {
  return (
    <Tabs defaultValue="description" className="max-w-xl">
      <TabsList aria-label="Información del producto">
        <TabsTrigger value="description">Descripción</TabsTrigger>
        <TabsTrigger value="specs">Especificaciones</TabsTrigger>
        <TabsTrigger value="reviews">Reseñas (12)</TabsTrigger>
      </TabsList>
      <TabsContent value="description" className="text-fg-secondary">
        Recrea el casco icónico del Capitán Rex con 854 piezas.
      </TabsContent>
      <TabsContent value="specs" className="text-fg-secondary">
        Edad 18+, 854 piezas, 20 cm de alto.
      </TabsContent>
      <TabsContent value="reviews" className="text-fg-secondary">
        Todavía no hay reseñas destacadas.
      </TabsContent>
    </Tabs>
  );
}

export const Default: Story = { render: () => <Example /> };
export const Dark: Story = { render: () => <Example />, globals: { theme: "dark" } };
