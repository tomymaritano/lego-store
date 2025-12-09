import type { Meta, StoryObj } from "@storybook/nextjs";
import { Input } from "./Input";
import { Search as SearchIcon, Mail, Lock, Eye } from "lucide-react";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
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
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: "Escribe algo...",
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Email</label>
      <Input type="email" placeholder="tu@email.com" />
    </div>
  ),
};

export const WithLeftIcon: Story = {
  args: {
    placeholder: "Buscar productos...",
    leftIcon: <SearchIcon className="w-4 h-4" />,
  },
};

export const WithRightIcon: Story = {
  args: {
    placeholder: "Contraseña",
    type: "password",
    rightIcon: <Eye className="w-4 h-4 cursor-pointer" />,
  },
};

export const WithBothIcons: Story = {
  args: {
    placeholder: "tu@email.com",
    leftIcon: <Mail className="w-4 h-4" />,
    rightIcon: <SearchIcon className="w-4 h-4" />,
  },
};

export const WithError: Story = {
  args: {
    placeholder: "Email",
    error: "Por favor ingresa un email válido",
    defaultValue: "email-invalido",
  },
};

export const Disabled: Story = {
  args: {
    placeholder: "Campo deshabilitado",
    disabled: true,
  },
};

export const Password: Story = {
  args: {
    type: "password",
    placeholder: "Contraseña",
    leftIcon: <Lock className="w-4 h-4" />,
  },
};

export const Number: Story = {
  args: {
    type: "number",
    placeholder: "Cantidad",
    min: 1,
    max: 99,
  },
};

export const SearchInput: Story = {
  args: {
    type: "search",
    placeholder: "Buscar sets de LEGO...",
    leftIcon: <SearchIcon className="w-4 h-4" />,
  },
};

export const FormExample: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Nombre completo</label>
        <Input placeholder="Juan Pérez" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Email</label>
        <Input type="email" placeholder="juan@email.com" leftIcon={<Mail className="w-4 h-4" />} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Contraseña</label>
        <Input type="password" placeholder="••••••••" leftIcon={<Lock className="w-4 h-4" />} />
      </div>
    </div>
  ),
};
