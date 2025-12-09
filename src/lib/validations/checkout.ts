import { z } from "zod";

/**
 * Checkout Form Validation Schemas
 *
 * Using Zod for type-safe validation.
 * These schemas can be used with react-hook-form's zodResolver.
 *
 * @example
 * import { useForm } from "react-hook-form";
 * import { zodResolver } from "@hookform/resolvers/zod";
 * import { shippingSchema, type ShippingFormData } from "@/lib/validations/checkout";
 *
 * const form = useForm<ShippingFormData>({
 *   resolver: zodResolver(shippingSchema),
 * });
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
    .default("México"),
});

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
});

// Infer TypeScript types from schemas
export type ShippingFormData = z.infer<typeof shippingSchema>;
export type PaymentFormData = z.infer<typeof paymentSchema>;

// Combined checkout schema (for full form validation)
export const checkoutSchema = z.object({
  shipping: shippingSchema,
  payment: paymentSchema,
});

export type CheckoutFormData = z.infer<typeof checkoutSchema>;
