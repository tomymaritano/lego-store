import { z } from "zod";
import type { ShippingInfo } from "@/types";
import { ARGENTINA_PROVINCES, SHIPPING_COUNTRY } from "@/lib/argentina";

/**
 * Checkout shipping form schema: the form's resolver (react-hook-form +
 * zodResolver) and the server, which validates the same data again before it
 * creates the order (src/lib/validations/orders.ts). The data shape is
 * declared once in @/types; `satisfies` keeps the schema in step with it.
 * Card details are collected by Stripe's Payment Element, never by us.
 */

const onlyDigits = (value: string) => value.replace(/\D/g, "");

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
