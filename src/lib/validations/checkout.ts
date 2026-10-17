import { z } from "zod";
import type { PaymentInfo, ShippingInfo } from "@/types";
import { ARGENTINA_PROVINCES, SHIPPING_COUNTRY } from "@/lib/argentina";
import { cardLength, cvvLength, detectCardBrand, isExpiryInFuture, onlyDigits, passesLuhn } from "@/lib/card";

/**
 * Checkout form schemas (react-hook-form + zodResolver). The data shapes are
 * declared once in @/types; `satisfies` keeps each schema in step with them.
 */

const text = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Ingresa ${label}`)
    .min(min, `${label[0].toUpperCase()}${label.slice(1)} debe tener al menos ${min} caracteres`)
    .max(max, `${label[0].toUpperCase()}${label.slice(1)} no puede superar ${max} caracteres`);

export const shippingSchema = z.object({
  firstName: text("tu nombre", 2, 50),
  lastName: text("tu apellido", 2, 50),
  email: z.string().trim().min(1, "Ingresa tu email").pipe(z.email("Ingresa un email válido")),
  phone: z
    .string()
    .trim()
    .min(1, "Ingresa tu teléfono")
    .regex(/^\+?[\d\s()-]+$/, "Usa solo números, espacios, guiones o +")
    .refine((value) => onlyDigits(value).length >= 10 && onlyDigits(value).length <= 13, {
      message: "El teléfono debe tener entre 10 y 13 dígitos (con código de área)",
    }),
  address: text("la dirección", 5, 200),
  city: text("la ciudad", 2, 80),
  state: z.string().refine((value) => (ARGENTINA_PROVINCES as readonly string[]).includes(value), "Elige una provincia"),
  zipCode: z
    .string()
    .trim()
    .min(1, "Ingresa el código postal")
    .regex(/^(\d{4}|[A-Za-z]\d{4}[A-Za-z]{3})$/, "Usa 4 dígitos (1425) o el formato CPA (C1425ABC)"),
  country: z.string().refine((value) => value === SHIPPING_COUNTRY, `Por ahora solo enviamos a ${SHIPPING_COUNTRY}`),
}) satisfies z.ZodType<ShippingInfo>;

export const paymentSchema = z
  .object({
    cardNumber: z.string().min(1, "Ingresa el número de tarjeta"),
    cardName: text("el nombre de la tarjeta", 3, 100),
    expiryDate: z
      .string()
      .min(1, "Ingresa el vencimiento")
      .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Usa el formato MM/AA")
      .refine((value) => isExpiryInFuture(value), "La tarjeta está vencida"),
    cvv: z.string().min(1, "Ingresa el código de seguridad").regex(/^\d+$/, "Usa solo números"),
  })
  .superRefine(({ cardNumber, cvv }, ctx) => {
    const brand = detectCardBrand(cardNumber);
    const digits = onlyDigits(cardNumber);
    if (digits.length > 0 && digits.length !== cardLength(brand)) {
      ctx.addIssue({ code: "custom", path: ["cardNumber"], message: `El número debe tener ${cardLength(brand)} dígitos` });
    } else if (digits.length > 0 && !passesLuhn(digits)) {
      ctx.addIssue({ code: "custom", path: ["cardNumber"], message: "Revisa el número: no es una tarjeta válida" });
    }
    if (/^\d+$/.test(cvv) && cvv.length !== cvvLength(brand)) {
      ctx.addIssue({ code: "custom", path: ["cvv"], message: `El código de seguridad tiene ${cvvLength(brand)} dígitos` });
    }
  }) satisfies z.ZodType<PaymentInfo>;
