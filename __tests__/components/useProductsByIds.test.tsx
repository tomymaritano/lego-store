import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useProductsByIds } from "@/hooks/useProductsByIds";
import { useCompareStore } from "@/stores";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const catalogue = new Set(["1", "2"]);

describe("useProductsByIds", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const ids = new URL(url, "http://localhost").searchParams.get("ids")!.split(",");
        const items = ids.filter((id) => catalogue.has(id)).map((id) => ({ id, name: `Set ${id}` }));
        return new Response(JSON.stringify({ items }), { status: 200 });
      })
    );
    useCompareStore.setState({ ids: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns products in the order of the ids", async () => {
    const { result } = renderHook(() => useProductsByIds(["2", "1"]), { wrapper });
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual(["2", "1"]));
  });

  it("reports ids the API no longer knows, so stores can drop them", async () => {
    const onMissing = vi.fn();
    renderHook(() => useProductsByIds(["999", "1", "998"], { onMissing }), { wrapper });
    await waitFor(() => expect(onMissing).toHaveBeenCalledWith(["998", "999"]));
  });

  it("prunes stale compare ids so count and capacity match what is shown", async () => {
    useCompareStore.setState({ ids: ["999", "1", "998", "997"] });
    const { result } = renderHook(
      () => {
        const ids = useCompareStore((state) => state.ids);
        return useProductsByIds(ids, { onMissing: useCompareStore.getState().removeMany });
      },
      { wrapper }
    );
    await waitFor(() => expect(useCompareStore.getState().ids).toEqual(["1"]));
    expect(result.current.products.map((p) => p.id)).toEqual(["1"]);
    expect(useCompareStore.getState().addToCompare("2")).toBe(true);
  });

  it("never prunes on a failed request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const onMissing = vi.fn();
    const { result } = renderHook(() => useProductsByIds(["1", "999"], { onMissing }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(onMissing).not.toHaveBeenCalled();
  });
});
