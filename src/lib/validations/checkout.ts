import { z } from "zod";
import type { PaymentInfo, ShippingInfo } from "@/types";

/**
 * Checkout form schemas (react-hook-form + zodResolver). The data shapes are
 * declared once in @/types; `satisfies` keeps each schema in step with them.
 */

// Shipping Information Schema
export const shippingSchema = z.object({
  firstName: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(50, "El nombre no puede exceder 50 caracteres"),
  lastName: z
    .string()
    .min(2, "El apellido debe tener al menos 2 caracteres")
    .max(50, "El apellido no puede exceder 50 caracteres"),
  email: z
    .string()
    .email("Ingresa un email válido"),
  phone: z
    .string()
    .min(10, "El teléfono debe tener al menos 10 dígitos")
    .regex(/^[0-9+\-\s()]+$/, "Ingresa un teléfono válido"),
  address: z
    .string()
    .min(5, "La dirección debe tener al menos 5 caracteres")
    .max(200, "La dirección no puede exceder 200 caracteres"),
  city: z
    .string()
    .min(2, "La ciudad debe tener al menos 2 caracteres"),
  state: z
    .string()
    .min(2, "El estado debe tener al menos 2 caracteres"),
  zipCode: z
    .string()
    .min(4, "El código postal debe tener al menos 4 caracteres")
    .max(10, "El código postal no puede exceder 10 caracteres"),
  country: z
    .string()
    .min(2, "El país debe tener al menos 2 caracteres"),
}) satisfies z.ZodType<ShippingInfo>;

// Payment Information Schema
export const paymentSchema = z.object({
  cardNumber: z
    .string()
    .min(16, "El número de tarjeta debe tener 16 dígitos")
    .max(19, "Número de tarjeta inválido") // With spaces: "1234 5678 9012 3456"
    .regex(/^[\d\s]+$/, "Solo se permiten números"),
  cardName: z
    .string()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  expiryDate: z
    .string()
    .regex(/^(0[1-9]|1[0-2])\/([0-9]{2})$/, "Formato inválido (MM/AA)"),
  cvv: z
    .string()
    .min(3, "El CVV debe tener 3-4 dígitos")
    .max(4, "El CVV debe tener 3-4 dígitos")
    .regex(/^\d+$/, "Solo se permiten números"),
}) satisfies z.ZodType<PaymentInfo>;

