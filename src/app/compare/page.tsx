import { CompareView } from "@/components/compare/CompareView";

/**
 * The compare list lives in localStorage (ids), so the table renders in the
 * CompareView island, which hydrates the products by id through the by-ids
 * Route Handler (lib/api).
 */
export default function ComparePage() {
  return <CompareView />;
}
