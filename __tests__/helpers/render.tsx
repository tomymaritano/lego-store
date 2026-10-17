import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** Renders inside a fresh React Query client (no retries, no cache between tests). */
export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** Stubs global fetch with a JSON handler that receives the parsed URL. */
export function mockFetch(handler: (url: URL) => unknown) {
  const fetchMock = async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    return new Response(JSON.stringify(handler(url)), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  globalThis.fetch = fetchMock as typeof fetch;
}
