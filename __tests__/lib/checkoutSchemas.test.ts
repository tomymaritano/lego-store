import { describe, it, expect } from "vitest";
import { paymentSchema, shippingSchema } from "@/lib/validations";

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

const nextYear = String((new Date().getFullYear() + 1) % 100).padStart(2, "0");
const payment = { cardNumber: "4242 4242 4242 4242", cardName: "ANA PEREZ", expiryDate: `12/${nextYear}`, cvv: "123" };

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

describe("paymentSchema", () => {
  it("accepts a valid Visa and Amex", () => {
    expect(paymentSchema.safeParse(payment).success).toBe(true);
    expect(paymentSchema.safeParse({ ...payment, cardNumber: "3782 822463 10005", cvv: "1234" }).success).toBe(true);
  });

  it("rejects short, mistyped or expired cards and wrong CVV lengths", () => {
    expect(messages(paymentSchema.safeParse({ ...payment, cardNumber: "4242 4242" }))).toMatchObject({
      cardNumber: "El número debe tener 16 dígitos",
    });
    expect(messages(paymentSchema.safeParse({ ...payment, cardNumber: "4242 4242 4242 4241" }))).toMatchObject({
      cardNumber: expect.stringContaining("no es una tarjeta válida"),
    });
    expect(messages(paymentSchema.safeParse({ ...payment, expiryDate: "01/20" }))).toMatchObject({
      expiryDate: "La tarjeta está vencida",
    });
    expect(messages(paymentSchema.safeParse({ ...payment, cardNumber: "3782 822463 10005" }))).toMatchObject({
      cvv: "El código de seguridad tiene 4 dígitos",
    });
  });

  it("asks for every empty field", () => {
    expect(messages(paymentSchema.safeParse({ cardNumber: "", cardName: "", expiryDate: "", cvv: "" }))).toMatchObject({
      cardNumber: "Ingresa el número de tarjeta",
      cardName: "Ingresa el nombre de la tarjeta",
      expiryDate: "Ingresa el vencimiento",
      cvv: "Ingresa el código de seguridad",
    });
  });
});
