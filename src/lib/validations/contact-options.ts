/** /contacto form options, kept apart from the zod schema so the form renders without loading zod. */
export const CONTACT_TOPICS = [
  { value: "pedido", label: "Estado de un pedido" },
  { value: "envio", label: "Envíos y entregas" },
  { value: "devolucion", label: "Cambios y devoluciones" },
  { value: "producto", label: "Consulta sobre un producto" },
  { value: "otro", label: "Otro motivo" },
] as const;

export const CONTACT_MESSAGE_MAX = 1000;
