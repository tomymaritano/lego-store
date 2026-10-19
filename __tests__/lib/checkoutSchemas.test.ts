import { describe, it, expect } from "vitest";
import { shippingSchema } from "@/lib/validations";
import { prepareOrderSchema } from "@/lib/validations/orders";

const shipping = {
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.com",
  phone: "11 5555 1234",
  address: "Av. Corrientes 1234",
  city: "CABA",
  state: "Ciudad Autónoma de Buenos Aires",
  zipCode: "C1043AAZ",
  country: "Argentina",
};


/** First message per field: the one react-hook-form's resolver shows. */
const messages = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) => {
  const byField: Record<string, string> = {};
  for (const issue of result.error?.issues ?? []) byField[issue.path.join(".")] ??= issue.message;
  return byField;
};

describe("shippingSchema", () => {
  it("accepts an Argentine address (4-digit or CPA postcode)", () => {
    expect(shippingSchema.safeParse(shipping).success).toBe(true);
    expect(shippingSchema.safeParse({ ...shipping, zipCode: "1425" }).success).toBe(true);
  });

  it("explains every empty field in Spanish", () => {
    const empty = Object.fromEntries(Object.keys(shipping).map((key) => [key, ""]));
    expect(messages(shippingSchema.safeParse(empty))).toMatchObject({
      firstName: "Ingresa tu nombre",
      email: "Ingresa tu email",
      phone: "Ingresa tu teléfono",
      state: "Elige una provincia",
      zipCode: "Ingresa el código postal",
      country: "Por ahora solo enviamos a Argentina",
    });
  });

  it("rejects provinces that are not Argentine and bad phones/postcodes", () => {
    const result = shippingSchema.safeParse({ ...shipping, state: "CDMX", phone: "123", zipCode: "06600" });
    expect(messages(result)).toMatchObject({
      state: "Elige una provincia",
      phone: expect.stringContaining("entre 10 y 13 dígitos"),
      zipCode: expect.stringContaining("4 dígitos"),
    });
  });
});

describe("prepareOrderSchema (server side of the checkout)", () => {
  const order = { shipping, lines: [{ productId: "1", quantity: 2 }], confirmationTokenId: "ctoken_1NnQ2kL" };

  it("accepts ids, quantities, the shipping form and a ConfirmationToken id", () => {
    expect(prepareOrderSchema.safeParse(order).success).toBe(true);
  });

  it("never takes prices or totals from the client: unknown keys are dropped", () => {
    const parsed = prepareOrderSchema.parse({ ...order, total: 1, lines: [{ productId: "1", quantity: 2, price: 1 }] });
    expect(parsed).not.toHaveProperty("total");
    expect(parsed.lines[0]).toEqual({ productId: "1", quantity: 2 });
  });

  it("rejects empty or repeated lines, bad quantities, card data and the shipping form's own errors", () => {
    expect(prepareOrderSchema.safeParse({ ...order, lines: [] }).success).toBe(false);
    expect(prepareOrderSchema.safeParse({ ...order, lines: [order.lines[0], order.lines[0]] }).success).toBe(false);
    expect(prepareOrderSchema.safeParse({ ...order, lines: [{ productId: "1", quantity: 0 }] }).success).toBe(false);
    expect(prepareOrderSchema.safeParse({ ...order, lines: [{ productId: "1", quantity: 1.5 }] }).success).toBe(false);
    expect(prepareOrderSchema.safeParse({ ...order, confirmationTokenId: "4242424242424242" }).success).toBe(false);
    expect(prepareOrderSchema.safeParse({ ...order, shipping: { ...shipping, state: "Atlantis" } }).success).toBe(false);
  });
});
