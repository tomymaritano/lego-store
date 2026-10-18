import { z } from "zod";
import { isAllowedImageUrl, REMOTE_IMAGE_HOSTS } from "@/lib/images";
import { idSchema } from "./ids";

/*
 * Inputs of the admin panel (src/lib/admin/actions.ts and the /admin pages'
 * search params). The server validates everything again here: the forms'
 * own checks are only a convenience.
 */

// ---------------------------------------------------------------------------
// Product form
// ---------------------------------------------------------------------------

/** Highest price, original price and stock the form takes (Postgres int4 holds far more). */
export const MAX_ADMIN_PRICE = 100_000_000;
export const MAX_ADMIN_STOCK = 1_000_000;
export const MAX_PRODUCT_IMAGES = 10;
export const MAX_PRODUCT_INTERESTS = 10;

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Completa ${label}`)
    .max(max, `Como máximo ${max} caracteres`);

const wholeNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Completa ${label}`)
    .regex(/^\d+$/, "Tiene que ser un número entero, sin puntos ni signos")
    .transform(Number)
    .pipe(
      z
        .number()
        .min(min, min === 0 ? "No puede ser negativo" : `Tiene que ser al menos ${min}`)
        .max(max, `Como máximo ${max.toLocaleString("es-AR")}`)
    );

const IMAGE_RULE = `Usa una ruta del sitio (/images/…) o una URL https de ${REMOTE_IMAGE_HOSTS.join(", ")}`;

const imageUrl = z.string().trim().min(1, "Completa la imagen principal").refine(isAllowedImageUrl, IMAGE_RULE);

/** "a, b , ,c" -> ["a", "b", "c"] (distinct, in order). */
export const splitList = (value: string, separator: RegExp) =>
  Array.from(new Set(value.split(separator).map((item) => item.trim()).filter(Boolean)));

/**
 * The product form as the browser sends it: every field a string (as in
 * FormData), flags as booleans. Interests are comma separated and the gallery
 * one URL per line.
 */
export const productFormSchema = z
  .object({
    name: text("el nombre", 120),
    price: wholeNumber("el precio", 1, MAX_ADMIN_PRICE),
    originalPrice: z.string().trim(),
    isNew: z.boolean(),
    isOnSale: z.boolean(),
    categoryId: z.string().trim().min(1, "Elige una categoría").max(64),
    type: text("el tipo", 60),
    age: text("la edad", 20),
    theme: text("el tema", 60),
    interests: z
      .string()
      .transform((value) => splitList(value, /,/))
      .pipe(
        z
          .array(z.string().max(40, "Cada interés: como máximo 40 caracteres"))
          .max(MAX_PRODUCT_INTERESTS, `Como máximo ${MAX_PRODUCT_INTERESTS} intereses`)
      ),
    pieces: text("las piezas", 20),
    highlight: text("el destacado", 60),
    img: imageUrl,
    imageSecondary: z
      .string()
      .trim()
      .refine((value) => value === "" || isAllowedImageUrl(value), IMAGE_RULE),
    images: z
      .string()
      .transform((value) => splitList(value, /\r?\n/))
      .pipe(
        z
          .array(z.string().refine(isAllowedImageUrl, `Hay una URL no permitida. ${IMAGE_RULE}`))
          .max(MAX_PRODUCT_IMAGES, `Como máximo ${MAX_PRODUCT_IMAGES} imágenes`)
      ),
    stock: wholeNumber("el stock", 0, MAX_ADMIN_STOCK),
    shortDescription: text("la descripción corta", 300),
    description: text("la descripción", 5000),
  })
  .transform((input, ctx) => {
    let originalPrice: number | null = null;
    if (input.isOnSale) {
      const parsed = /^\d+$/.test(input.originalPrice) ? Number(input.originalPrice) : NaN;
      if (input.originalPrice === "") {
        ctx.addIssue({ code: "custom", path: ["originalPrice"], message: "Un producto en oferta necesita el precio anterior" });
      } else if (!Number.isInteger(parsed) || parsed > MAX_ADMIN_PRICE) {
        ctx.addIssue({ code: "custom", path: ["originalPrice"], message: "Tiene que ser un número entero, sin puntos ni signos" });
      } else if (parsed <= input.price) {
        ctx.addIssue({ code: "custom", path: ["originalPrice"], message: "Tiene que ser mayor que el precio actual" });
      } else {
        originalPrice = parsed;
      }
    }
    // The gallery always has at least the main picture (the product page shows it).
    const images = input.images.length > 0 ? input.images : [input.img];
    return {
      ...input,
      // Not on sale: no original price (the database requires both or neither).
      originalPrice,
      imageSecondary: input.imageSecondary === "" ? null : input.imageSecondary,
      images,
    };
  });

export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductInput = z.output<typeof productFormSchema>;
export type ProductField = keyof ProductFormInput;

/**
 * The stock a form or the quick edit loaded (a hidden value, not typed): the
 * write only lands while the product still has it (src/lib/admin/products.ts).
 */
export const stockSeenSchema = z
  .string()
  .trim()
  .regex(/^\d{1,9}$/)
  .transform(Number);

/** Quick stock edit from the products list or the dashboard. */
export const stockUpdateSchema = z.object({
  productId: idSchema,
  stock: wholeNumber("el stock", 0, MAX_ADMIN_STOCK),
  seen: stockSeenSchema,
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
export const orderStatusSchema = z.enum(ORDER_STATUSES);

/** The statuses an admin can move an order to (see src/lib/admin/orders.ts for which from where). */
export const orderTransitionSchema = z.object({
  orderId: idSchema,
  to: z.enum(["SHIPPED", "DELIVERED", "CANCELLED"]),
  /** The status the admin saw: if it changed meanwhile, nothing happens. */
  expected: orderStatusSchema,
});

export type OrderTransitionInput = z.infer<typeof orderTransitionSchema>;

// ---------------------------------------------------------------------------
// List filters (search params). Anything invalid falls back to "no filter":
// a hand-edited URL shows the unfiltered list instead of an error.
// ---------------------------------------------------------------------------

export const ADMIN_PAGE_SIZE = 20;

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

const pageOf = (value: string) => {
  const page = /^\d{1,6}$/.test(value) ? Number(value) : 1;
  return Math.max(1, page);
};

const textParam = (value: string, max = 100) => value.trim().slice(0, max);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateParam = (value: string) => (DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : "");

export const PRODUCT_STATUS_FILTERS = ["active", "archived", "all"] as const;
export const PRODUCT_STOCK_FILTERS = ["low", "out"] as const;

export interface AdminProductFilters {
  q: string;
  category: string;
  status: (typeof PRODUCT_STATUS_FILTERS)[number];
  stock: (typeof PRODUCT_STOCK_FILTERS)[number] | "";
  page: number;
}

export function parseProductFilters(params: SearchParams): AdminProductFilters {
  const status = first(params.status);
  const stock = first(params.stock);
  return {
    q: textParam(first(params.q)),
    category: textParam(first(params.category), 64),
    status: (PRODUCT_STATUS_FILTERS as readonly string[]).includes(status) ? (status as AdminProductFilters["status"]) : "active",
    stock: (PRODUCT_STOCK_FILTERS as readonly string[]).includes(stock) ? (stock as AdminProductFilters["stock"]) : "",
    page: pageOf(first(params.page)),
  };
}

/** Order list status filter: a status, or the cancelled orders whose charge did not match their total. */
export const ORDER_STATUS_FILTERS = [...ORDER_STATUSES, "amount_mismatch"] as const;
export type OrderStatusFilter = (typeof ORDER_STATUS_FILTERS)[number];

export interface AdminOrderFilters {
  status: OrderStatusFilter | "";
  /** Part of the customer's email (or the order number "LEGO-001001" / "1001"). */
  q: string;
  /** Store-time calendar dates, inclusive (YYYY-MM-DD). */
  from: string;
  to: string;
  page: number;
}

export function parseOrderFilters(params: SearchParams): AdminOrderFilters {
  const status = first(params.status);
  return {
    status: (ORDER_STATUS_FILTERS as readonly string[]).includes(status) ? (status as OrderStatusFilter) : "",
    q: textParam(first(params.q), 254),
    from: dateParam(first(params.from)),
    to: dateParam(first(params.to)),
    page: pageOf(first(params.page)),
  };
}

export interface AdminReviewFilters {
  q: string;
  /** Product id. */
  product: string;
  rating: number | null;
  page: number;
}

export function parseReviewFilters(params: SearchParams): AdminReviewFilters {
  const rating = first(params.rating);
  return {
    q: textParam(first(params.q)),
    product: textParam(first(params.product), 64),
    rating: /^[1-5]$/.test(rating) ? Number(rating) : null,
    page: pageOf(first(params.page)),
  };
}
