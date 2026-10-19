import { Prisma } from "@/generated/prisma/client";
import { productSearchColumns } from "@/lib/api/search";

/*
 * What categories and themes (./categories.ts, ./themes.ts) share: their
 * order, and the products' search columns that repeat their names.
 */

type Tx = Prisma.TransactionClient;

export type Direction = "up" | "down";

/**
 * Moves a row one place up or down in its table's order (Category or Theme
 * `position`), locking the whole table's rows so two moves at once cannot
 * scramble it. Positions are rewritten as 0..n-1 on the way, so gaps or
 * ties left by creations and deletions never accumulate. Null when the row
 * does not exist; `moved: false` when it is already first (up) or last (down).
 */
export async function moveInOrder(
  tx: Tx,
  table: "Category" | "Theme",
  id: string,
  direction: Direction
): Promise<{ moved: boolean; from: number; to: number } | null> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM ${Prisma.raw(`"${table}"`)} ORDER BY "position", "id" FOR UPDATE`;
  const ids = rows.map((row) => row.id);
  const from = ids.indexOf(id);
  if (from === -1) return null;
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return { moved: false, from, to: from };
  [ids[from], ids[to]] = [ids[to]!, ids[from]!];
  await tx.$executeRaw`
    UPDATE ${Prisma.raw(`"${table}"`)} AS t SET "position" = o.position - 1
    FROM unnest(${ids}::text[]) WITH ORDINALITY AS o(id, position)
    WHERE t."id" = o.id AND t."position" <> o.position - 1
  `;
  return { moved: true, from, to };
}

/** The position a new row takes: after every other one. */
export async function nextPosition(tx: Tx, table: "Category" | "Theme"): Promise<number> {
  const [row] = await tx.$queryRaw<{ next: number }[]>`SELECT COALESCE(MAX("position") + 1, 0)::int AS next FROM ${Prisma.raw(`"${table}"`)}`;
  return row?.next ?? 0;
}

/**
 * Recomputes Product.searchText / searchName (src/lib/api/search.ts) for the
 * products of a category or theme whose name or slug changed: search matches
 * those names, so the columns that repeat them must follow.
 */
export async function refreshSearchColumns(tx: Tx, where: Prisma.ProductWhereInput): Promise<string[]> {
  const products = await tx.product.findMany({
    where,
    select: { id: true, name: true, description: true, categoryId: true, category: { select: { name: true } }, theme: { select: { name: true } } },
  });
  for (const product of products) {
    await tx.product.update({
      where: { id: product.id },
      data: productSearchColumns({
        name: product.name,
        theme: product.theme.name,
        categoryId: product.categoryId,
        categoryName: product.category.name,
        description: product.description,
      }),
    });
  }
  return products.map((product) => product.id);
}
