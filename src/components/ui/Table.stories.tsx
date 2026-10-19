import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./Badge";
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "./Table";

const meta = {
  title: "UI/Table",
  component: Table,
  tags: ["autodocs"],
  args: { label: "Pedidos" },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const orders = [
  { number: "LEGO-001001", customer: "Ana Pérez", status: { label: "Pagado", variant: "success" }, total: "$ 1.897" },
  { number: "LEGO-001002", customer: "Bruno Díaz", status: { label: "Enviado", variant: "new" }, total: "$ 12.999" },
  { number: "LEGO-001003", customer: "Carla Gómez", status: { label: "Cancelado", variant: "danger" }, total: "$ 649" },
] as const;

function Example({ label }: { label: string }) {
  return (
    <div className="max-w-3xl">
      <Table label={label}>
        <TableCaption>Últimos pedidos de la tienda.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Pedido</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.number}>
              <TableCell className="font-medium">{order.number}</TableCell>
              <TableCell>{order.customer}</TableCell>
              <TableCell>
                <Badge variant={order.status.variant}>{order.status.label}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{order.total}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Total</TableCell>
            <TableCell className="text-right tabular-nums">$ 15.545</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

export const Default: Story = { render: (args) => <Example label={args.label} /> };
export const Dark: Story = { render: (args) => <Example label={args.label} />, globals: { theme: "dark" } };
/** On a phone the table scrolls inside its frame, which takes keyboard focus. */
export const Narrow: Story = {
  render: (args) => (
    <div className="w-72">
      <Example label={args.label} />
    </div>
  ),
};
