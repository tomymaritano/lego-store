import { z } from "zod";
import { getMercadoPagoMockControls } from "@/lib/payments/config";

/**
 * POST /api/test/mercadopago: the e2e suite's hand on the mock Mercado Pago
 * (PAYMENTS_MOCK=1 only; a 404 anywhere else, and always in a production
 * build, which never runs the mock: lib/payments/config.ts). It does what
 * Mercado Pago would do on its own (a cash ticket paid at the counter, a
 * review decided, an account-money payment of a preference); the spec then
 * sends the signed notification, as Mercado Pago would.
 */
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_status"), paymentId: z.string().regex(/^\d{1,20}$/), status: z.string().max(40), statusDetail: z.string().max(80).nullable() }),
  z.object({ action: z.literal("pay_preference"), preferenceId: z.string().max(80) }),
]);

export async function POST(request: Request) {
  const controls = getMercadoPagoMockControls();
  if (!controls) return new Response(null, { status: 404 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 400 });
  try {
    const payment =
      parsed.data.action === "set_status"
        ? controls.setStatus(parsed.data.paymentId, parsed.data.status, parsed.data.statusDetail)
        : controls.payPreference(parsed.data.preferenceId);
    return Response.json({ payment });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Error" }, { status: 404 });
  }
}
