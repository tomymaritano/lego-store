import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { stubFormAction } from "@/components/auth/stub-action";
import type { AdminOrderRow } from "@/lib/admin/orders";
import { AdminNav } from "./AdminNav";
import { AdminStat } from "./AdminStat";
import { ConfirmAction } from "./ConfirmAction";
import { OrdersTable } from "./OrdersTable";
import { Pagination } from "./Pagination";
import { EMPTY_PRODUCT, ProductForm } from "./ProductForm";
import { StockQuickEdit } from "./StockQuickEdit";
import { Banknote, Truck } from "lucide-react";

/** Admin panel pieces with stand-in Server Actions (src/lib/admin/actions.ts has the real ones). */

const meta = {
  title: "Admin/Panel",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const orders: AdminOrderRow[] = [
  {
    id: "o1",
    number: 1001,
    status: "PAID",
    cancelReason: null,
    email: "ana@example.com",
    customer: "Ana Pérez",
    hasAccount: true,
    total: 1897,
    itemCount: 2,
    createdAt: "2026-10-18T13:00:00.000Z",
    submittedAt: "2026-10-18T13:02:00.000Z",
  },
  {
    id: "o2",
    number: 1002,
    status: "CANCELLED",
    cancelReason: "amount_mismatch",
    email: "bruno@example.com",
    customer: "Bruno Díaz",
    hasAccount: false,
    total: 12999,
    itemCount: 1,
    createdAt: "2026-10-17T20:00:00.000Z",
    submittedAt: null,
  },
];

const stockAction = async (_id: string, stock: string) => ({ ok: true as const, message: `Stock actualizado: ${stock}.` });
const confirmAction = async () => ({ ok: true as const, message: "Listo." });

function Overview() {
  return (
    <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <AdminNav />
      <div className="min-w-0 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminStat icon={<Banknote />} label="Ingresos" value="$ 15.545" detail="$ 1.897 hoy" />
          <AdminStat icon={<Truck />} label="Por enviar" value={3} detail="1 pago pendiente" href="/admin/orders?status=PAID" tone="warning" />
        </div>
        <OrdersTable orders={orders} label="Pedidos" />
        <Pagination path="/admin/orders" params={{ status: "PAID" }} page={2} totalPages={3} total={47} noun={["pedido"]} />
        <div className="flex flex-wrap items-center gap-4">
          <StockQuickEdit productId="7" productName="Batmobile" stock={3} action={stockAction} />
          <ConfirmAction
            label="Cancelar y reembolsar"
            title="¿Cancelar LEGO-001001?"
            description="Reembolsamos $ 1.897 en Stripe y devolvemos el stock. No se puede deshacer."
            confirmLabel="Cancelar y reembolsar"
            confirmVariant="destructive"
            action={confirmAction}
          />
        </div>
      </div>
    </div>
  );
}

export const Panel: Story = { render: () => <Overview /> };
export const PanelDark: Story = { render: () => <Overview />, globals: { theme: "dark" } };

const form = (
  <div className="max-w-3xl">
    <ProductForm
      mode="create"
      action={stubFormAction({ status: "error", message: "Revisa los campos marcados.", fieldErrors: { price: "Completa el precio" } })}
      initial={{ ...EMPTY_PRODUCT, name: "Torre de prueba", img: "/images/lego.png", images: ["/images/lego.png", "https://example.com/x.png"] }}
      categories={[
        { id: "buildings", name: "Edificios" },
        { id: "cars", name: "Vehículos" },
      ]}
      suggestions={{ type: ["Set"], age: ["18+"], theme: ["Star Wars"], pieces: ["501-1000"], highlight: ["Exclusivo"], interests: ["Naves"] }}
    />
  </div>
);

export const ProductFormStory: Story = { name: "Product form", render: () => form };
export const ProductFormDark: Story = { name: "Product form (dark)", render: () => form, globals: { theme: "dark" } };
