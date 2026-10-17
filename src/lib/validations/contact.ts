import { z } from "zod";

/** Footer / home newsletter sign-up. */
export const newsletterSchema = z.object({
  email: z.string().trim().min(1, "Ingresa tu email").pipe(z.email("Ingresa un email válido")),
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;

export const CONTACT_TOPICS = [
  { value: "pedido", label: "Estado de un pedido" },
  { value: "envio", label: "Envíos y entregas" },
  { value: "devolucion", label: "Cambios y devoluciones" },
  { value: "producto", label: "Consulta sobre un producto" },
  { value: "otro", label: "Otro motivo" },
] as const;

export const CONTACT_MESSAGE_MAX = 1000;

/** /contacto form. */
export const contactSchema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre (al menos 2 caracteres)").max(80, "El nombre no puede superar 80 caracteres"),
  email: z.string().trim().min(1, "Ingresa tu email").pipe(z.email("Ingresa un email válido")),
  topic: z.enum(CONTACT_TOPICS.map((t) => t.value) as [string, ...string[]], { message: "Elige un motivo" }),
  orderNumber: z
    .string()
    .trim()
    .regex(/^$|^[A-Za-z0-9-]{4,20}$/, "El número de pedido tiene entre 4 y 20 letras, números o guiones")
    .optional(),
  message: z
    .string()
    .trim()
    .min(20, "Cuéntanos un poco más (al menos 20 caracteres)")
    .max(CONTACT_MESSAGE_MAX, `El mensaje no puede superar ${CONTACT_MESSAGE_MAX} caracteres`),
});

export type ContactInput = z.infer<typeof contactSchema>;
