import type { Page } from "@playwright/test";

interface SeededLine {
  id: string;
  name: string;
  price: number;
  image: string;
  stock: number;
}

/**
 * A visitor's cart refreshes its lines from the catalogue on load (current
 * name, price and stock: GET /api/products/by-ids). Specs that seed a cart
 * with made-up names and prices, to check totals or a long name, keep them by
 * answering that refresh with the seeded values for those ids (every other
 * field, and every other id, comes from the real catalogue).
 */
export async function keepSeededCart(page: Page, lines: SeededLine[]) {
  const seeded = new Map(lines.map((line) => [line.id, line]));
  await page.route(/\/api\/products\/by-ids/, async (route) => {
    try {
      const response = await route.fetch();
      const { items } = (await response.json()) as { items: { id: string }[] };
      const patched = items.map((item) => {
        const line = seeded.get(item.id);
        return line ? { ...item, name: line.name, price: line.price, img: line.image, stock: line.stock } : item;
      });
      await route.fulfill({ response, json: { items: patched } });
    } catch {
      // The test ended (page closed) while this request was in flight: nothing left to answer.
    }
  });
}
