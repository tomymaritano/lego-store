import { z } from "zod";
import { storeDayEnd, storeDayStart } from "@/lib/admin/format";
import { COUPON_CODE_MAX, COUPON_CODE_PATTERN, normalizeCouponCode } from "@/lib/coupons/rules";
import { MAX_ADMIN_PRICE } from "./admin";
import { COUPON_CODE_MESSAGE, couponCodeSchema } from "./coupon-code";
import { prepareOrderSchema } from "./orders";

export { COUPON_CODE_MESSAGE, couponCodeSchema };

/*
 * Coupon inputs: the code customers type (cart, checkout) and the admin's
 * coupon form. Codes are normalised (trimmed, uppercase) before anything
 * reads them, so "bienvenida10" and "BIENVENIDA10" are the same coupon.
 */

/**
 * POST /api/checkout/coupon: does this code apply to these lines? The lines
 * are priced on the server. No email: an email's uses are only checked when
 * a payment is submitted (src/lib/coupons/server.ts), so this never tells
 * whether some email has used a coupon. `recheck`: the cart or the checkout
 * asking again about the coupon it already applied, with the `recheckToken`
 * its quote came with (its own rate limit only with a valid one:
 * src/lib/coupons/recheck.ts).
 */
export const couponQuoteSchema = z.object({
  code: couponCodeSchema,
  lines: prepareOrderSchema.shape.lines,
  recheck: z.boolean().optional(),
  recheckToken: z.string().max(128).optional(),
});

export type CouponQuoteInput = z.infer<typeof couponQuoteSchema>;

// ---------------------------------------------------------------------------
// Admin form
// ---------------------------------------------------------------------------

export const COUPON_TYPES = ["PERCENT", "FIXED"] as const;
export const COUPON_DESCRIPTION_MAX = 200;
/** Most uses a limit takes (Postgres int4 holds far more; no store needs more). */
export const MAX_COUPON_USES = 1_000_000;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const optionalWhole = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), "Tiene que ser un número entero, sin puntos ni signos")
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => value === null || value >= min, `${label}: tiene que ser al menos ${min}`)
    .refine((value) => value === null || value <= max, `${label}: como máximo ${max.toLocaleString("es-AR")}`);

const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || (DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))), "Elige una fecha válida");

/**
 * The coupon form as the browser sends it (strings, as in FormData; `active`
 * as a boolean). Dates are store calendar days: "Válido desde" starts that
 * day, "Válido hasta" includes it (the coupon expires when the next day
 * starts). Empty limits mean no limit.
 */
export const couponFormSchema = z
  .object({
    /** Only read when creating: a coupon's code never changes (orders keep it). */
    code: z.string(),
    description: z.string().trim().max(COUPON_DESCRIPTION_MAX, `Como máximo ${COUPON_DESCRIPTION_MAX} caracteres`),
    type: z.enum(COUPON_TYPES, "Elige el tipo de descuento"),
    value: z.string().trim(),
    minSubtotal: optionalWhole("La compra mínima", 0, MAX_ADMIN_PRICE),
    startsAt: optionalDate,
    expiresAt: optionalDate,
    maxRedemptions: optionalWhole("El límite total", 1, MAX_COUPON_USES),
    maxPerUser: optionalWhole("El límite por cliente", 1, MAX_COUPON_USES),
    active: z.boolean(),
  })
  .transform((input, ctx) => {
    const value = /^\d+$/.test(input.value) ? Number(input.value) : NaN;
    if (input.value === "") {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Completa el valor del descuento" });
    } else if (!Number.isInteger(value)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Tiene que ser un número entero, sin puntos ni signos" });
    } else if (input.type === "PERCENT" && (value < 1 || value > 100)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Un porcentaje va de 1 a 100" });
    } else if (input.type === "FIXED" && (value < 1 || value > MAX_ADMIN_PRICE)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: `Entre $1 y ${MAX_ADMIN_PRICE.toLocaleString("es-AR")} pesos` });
    }
    const startsAt = input.startsAt ? storeDayStart(input.startsAt) : null;
    const expiresAt = input.expiresAt ? storeDayEnd(input.expiresAt) : null;
    if (startsAt && expiresAt && expiresAt <= startsAt) {
      ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "Tiene que ser el mismo día que el inicio o después" });
    }
    if (input.maxPerUser !== null && input.maxRedemptions !== null && input.maxPerUser > input.maxRedemptions) {
      ctx.addIssue({ code: "custom", path: ["maxPerUser"], message: "No puede ser mayor que el límite total" });
    }
    return {
      description: input.description,
      type: input.type,
      value,
      minSubtotal: input.minSubtotal ?? 0,
      startsAt,
      expiresAt,
      maxRedemptions: input.maxRedemptions,
      maxPerUser: input.maxPerUser,
      active: input.active,
    };
  });

export type CouponFormInput = z.input<typeof couponFormSchema>;
export type CouponInput = z.output<typeof couponFormSchema>;
export type CouponField = keyof CouponFormInput;

/** The code field of a new coupon (its own message: the form shows it under the field). */
export const newCouponCodeSchema = z
  .string()
  .transform(normalizeCouponCode)
  .pipe(z.string().min(1, "Completa el código").regex(COUPON_CODE_PATTERN, COUPON_CODE_MESSAGE));

// ---------------------------------------------------------------------------
// List filters
// ---------------------------------------------------------------------------

export const COUPON_STATUS_FILTERS = ["active", "scheduled", "expired", "exhausted", "inactive"] as const;
export type CouponStatus = (typeof COUPON_STATUS_FILTERS)[number];

export interface AdminCouponFilters {
  q: string;
  status: CouponStatus | "";
  page: number;
}

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export function parseCouponFilters(params: SearchParams): AdminCouponFilters {
  const status = first(params.status);
  const page = /^\d{1,6}$/.test(first(params.page)) ? Math.max(1, Number(first(params.page))) : 1;
  return {
    q: first(params.q).trim().slice(0, COUPON_CODE_MAX),
    status: (COUPON_STATUS_FILTERS as readonly string[]).includes(status) ? (status as CouponStatus) : "",
    page,
  };
}
