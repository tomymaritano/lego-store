/**
 * A product's collection ("highlight": Destacados, Exclusivos, Edición
 * Limitada) as a badge on one product. The collection names are plural
 * because they name a filter group ("Colección: Exclusivos"); a badge on a
 * single product reads singular, the same on the card and on its page.
 */

/** The singular badge label of a collection; an unknown one is shown as stored. */
export function collectionBadgeLabel(highlight: string): string {
  const labels: Record<string, string> = {
    Destacados: "Destacado",
    Exclusivos: "Exclusivo",
    "Edición Limitada": "Edición limitada",
  };
  return labels[highlight] ?? highlight;
}
