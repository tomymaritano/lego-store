import "server-only";

import * as z from "zod";
import {
  MAX_FILTER_VALUES,
  MAX_PAGE_SIZE,
  MAX_PRICE,
  MAX_SEARCH_LENGTH,
  MAX_SEARCH_TERMS,
  SORT_OPTIONS,
  isValidFilterValue,
  parseProductQuery,
} from "@/lib/productQuery";
import type { ProductQuery, SortOption } from "@/types";

/*
 * The server's contract for a catalogue query coming from a URL. The parsing
 * (parseProductQuery) is shared with the client and already drops or clamps
 * anything out of range; this zod schema re-checks its result before it
 * reaches Prisma, so a regression in the parser is a 400, never a database
 * error (an int4 overflow, a NUL byte in text) or an unbounded query.
 */

const filterValue = z.string().refine(isValidFilterValue, "Valor de filtro inválido");
const filterList = z.array(filterValue).min(1).max(MAX_FILTER_VALUES);
const price = z.number().int().min(0).max(MAX_PRICE);
const sortValues = SORT_OPTIONS.map((option) => option.value) as [SortOption, ...SortOption[]];

export const productQuerySchema = z
  .object({
    q: z
      .string()
      .min(1)
      .max(MAX_SEARCH_LENGTH)
      .refine((q) => q.split(" ").length <= MAX_SEARCH_TERMS, "Demasiados términos de búsqueda")
      .refine((q) => !/[\u0000-\u001f\u007f]/.test(q), "Búsqueda inválida"),
    category: filterValue,
    themes: filterList,
    types: filterList,
    ages: filterList,
    interests: filterList,
    pieces: filterList,
    highlights: filterList,
    minPrice: price,
    maxPrice: price,
    minRating: z.number().min(0).max(5),
    inStock: z.literal(true),
    onSale: z.literal(true),
    isNew: z.literal(true),
    sort: z.enum(sortValues),
    page: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    limit: z.number().int().min(1).max(MAX_PAGE_SIZE),
  })
  .partial()
  .strict() satisfies z.ZodType<ProductQuery>;

type ParamsInput = Parameters<typeof parseProductQuery>[0];

/**
 * A validated ProductQuery from URL search params, or null when it does not
 * pass the schema (the Route Handlers answer 400).
 */
export function readProductQuery(params: ParamsInput): ProductQuery | null {
  const result = productQuerySchema.safeParse(parseProductQuery(params));
  return result.success ? result.data : null;
}
