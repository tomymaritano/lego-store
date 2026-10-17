import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Mail, Search } from "lucide-react";
import { Field } from "./Field";
import { Input, Textarea } from "./Input";

const meta = {
  title: "UI/Field",
  component: Field,
  tags: ["autodocs"],
  args: { label: "Email", children: null },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

function FormExample() {
  return (
    <form className="flex max-w-md flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
      <Field label="Nombre" hint="Como aparece en tu documento" required>
        <Input placeholder="Juan Pérez" autoComplete="name" />
      </Field>
      <Field label="Email" error="Ingresá un email válido">
        <Input type="email" defaultValue="juan@" leftIcon={<Mail />} />
      </Field>
      <Field label="Buscar" hideLabel>
        <Input type="search" placeholder="Buscar sets…" leftIcon={<Search />} />
      </Field>
      <Field label="Comentario" hint="Máximo 500 caracteres">
        <Textarea placeholder="Contanos tu experiencia" />
      </Field>
      <Field label="Código postal" disabled>
        <Input defaultValue="1414" />
      </Field>
    </form>
  );
}

export const Default: Story = { render: () => <FormExample /> };
export const Dark: Story = { render: () => <FormExample />, globals: { theme: "dark" } };
