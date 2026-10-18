import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductReviews } from "@/components/product/ProductReviews";
import { ViewerProvider, type Viewer } from "@/providers/ViewerProvider";
import { showToast } from "@/components/ui";
import { createReviewAction, deleteReviewAction, setHelpfulAction, updateReviewAction } from "@/lib/reviews/actions";
import { mockReviews } from "../../prisma/seed/mock-reviews";
import type { Review, ReviewPage, ViewerReviews } from "@/types";

// The Server Actions are the boundary: stubbed here, covered against the database in
// __tests__/integration/review-writes.test.ts.
vi.mock("@/lib/reviews/actions", () => ({
  createReviewAction: vi.fn(),
  updateReviewAction: vi.fn(),
  deleteReviewAction: vi.fn(),
  setHelpfulAction: vi.fn(),
}));

const ANA: Viewer = { id: "u-ana", name: "Ana Pérez" };

function pageOf(items: Review[], { page = 1, total = items.length, sort = "recent" as ReviewPage["sort"] } = {}): ReviewPage {
  const all = page === 1 ? items : items;
  const average = all.length ? Math.round((all.reduce((sum, r) => sum + r.rating, 0) / all.length) * 10) / 10 : 0;
  return {
    items,
    summary: {
      average,
      count: total,
      distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: all.filter((r) => r.rating === rating).length })),
    },
    sort,
    page,
    limit: 5,
    totalPages: Math.ceil(total / 5),
    hasMore: page < Math.ceil(total / 5),
  };
}

// Published reviews of product 1, as the product page reads them from the database (newest first).
const published = mockReviews.filter((r) => r.productId === "1").sort((a, b) => b.date.localeCompare(a.date));
const EMPTY = pageOf([]);

interface Server {
  pages: (url: URL) => ReviewPage;
  mine: ViewerReviews;
  requests: URL[];
}

let server: Server;

beforeEach(() => {
  vi.mocked(createReviewAction).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(updateReviewAction).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(deleteReviewAction).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(setHelpfulAction).mockReset();
  server = { pages: () => pageOf(published), mine: { review: null, helpful: [] }, requests: [] };
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    server.requests.push(url);
    const body = url.pathname.endsWith("/mine") ? server.mine : server.pages(url);
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
});

function renderReviews(ui: ReactElement, viewer: Viewer | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrap = (node: ReactElement) => (
    <QueryClientProvider client={client}>
      <ViewerProvider viewer={viewer}>{node}</ViewerProvider>
    </QueryClientProvider>
  );
  const result = render(wrap(ui));
  return { ...result, rerender: (node: ReactElement) => result.rerender(wrap(node)) };
}

/** The user's own review and votes have loaded (the write button is enabled then). */
const waitUntilViewerLoaded = () =>
  waitFor(() => expect(screen.getByRole("button", { name: /reseña$/ })).not.toHaveAttribute("aria-disabled", "true"));

/** Opens the review form; it loads on demand, so wait for its submit button. */
async function openForm(name = "Escribir reseña", submit = "Publicar reseña") {
  const toggle = await screen.findByRole("button", { name });
  await waitFor(() => expect(toggle).not.toHaveAttribute("aria-disabled", "true"));
  fireEvent.click(toggle);
  await screen.findByRole("button", { name: submit }, { timeout: 5000 });
}

describe("ProductReviews", () => {
  // The form is a next/dynamic chunk: warm the module once so a busy parallel run
  // does not spend the first test's timeout on importing zod and react-hook-form.
  beforeAll(async () => {
    await import("@/components/product/reviews/ReviewForm");
  });

  it("shows the product's reviews with h2 > h3 headings inside a labelled section", () => {
    renderReviews(<ProductReviews productId="1" initialPage={pageOf(published)} />);
    const section = screen.getByRole("region", { name: "Reseñas de clientes" });
    expect(within(section).getAllByRole("heading", { level: 3 })).toHaveLength(published.length);
    expect(within(section).queryByRole("heading", { level: 4 })).toBeNull();
  });

  it("formats dates in Spanish, in the server's order, without a request for the first page", () => {
    renderReviews(<ProductReviews productId="1" initialPage={pageOf(published)} />);
    const times = screen.getAllByRole("listitem").flatMap((li) => Array.from(li.querySelectorAll("time")));
    expect(times.map((t) => t.getAttribute("datetime"))).toEqual(["2024-01-15", "2024-01-10"]);
    expect(times[0]).toHaveTextContent("15 de enero de 2024");
    expect(server.requests).toEqual([]);
  });

  it("with no reviews shows only an empty state, never a 0-star score or an empty histogram", () => {
    renderReviews(<ProductReviews productId="2" initialPage={EMPTY} />);
    expect(screen.getByRole("heading", { level: 3, name: "Aún no hay reseñas" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Distribución de valoraciones" })).toBeNull();
    expect(screen.queryByText(/de 5/)).toBeNull();
  });

  it("sorts on the server and loads more pages", async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...published[0]!, id: `r${i}`, title: `Reseña ${i}` }));
    server.pages = (url) => {
      const page = Number(url.searchParams.get("page"));
      return pageOf(page === 1 ? many.slice(0, 5) : many.slice(5), { page, total: 7 });
    };
    renderReviews(<ProductReviews productId="1" initialPage={pageOf(many.slice(0, 5), { total: 7 })} />);
    expect(screen.getAllByTestId("review")).toHaveLength(5);

    const more = screen.getByRole("button", { name: "Ver más reseñas" });
    more.focus();
    fireEvent.click(more);
    await waitFor(() => expect(screen.getAllByTestId("review")).toHaveLength(7));
    expect(server.requests.at(-1)?.search).toBe("?sort=recent&page=2");
    // The button is gone (last page): focus moves to the first review it loaded, not to <body>.
    expect(screen.queryByRole("button", { name: "Ver más reseñas" })).toBeNull();
    await waitFor(() => expect(screen.getAllByTestId("review")[5]).toHaveFocus());
    expect(screen.queryByRole("button", { name: "Ver más reseñas" })).toBeNull();
  });

  describe("signed out", () => {
    it("sends visitors to log in to write a review, back to the form afterwards", () => {
      renderReviews(<ProductReviews productId="1" initialPage={pageOf(published)} />);
      expect(screen.getByRole("link", { name: "Escribir reseña" })).toHaveAttribute(
        "href",
        `/login?${new URLSearchParams({ callbackUrl: "/item/1#escribir-resena" })}`
      );
      expect(screen.getByText("Inicia sesión para opinar")).toBeInTheDocument();
    });

    it("asks visitors to log in to vote, without calling the server", () => {
      const info = vi.spyOn(showToast, "info").mockImplementation(() => {});
      renderReviews(<ProductReviews productId="1" initialPage={pageOf(published)} />);
      fireEvent.click(screen.getAllByRole("button", { name: /Útil/ })[0]!);
      expect(info).toHaveBeenCalledWith("Inicia sesión para marcar reseñas como útiles.");
      expect(setHelpfulAction).not.toHaveBeenCalled();
      info.mockRestore();
    });

    it("a 'write a review' link focuses the login link", () => {
      const { rerender } = renderReviews(<ProductReviews productId="1" initialPage={pageOf(published)} focusRequest={null} />);
      rerender(<ProductReviews productId="1" initialPage={pageOf(published)} focusRequest={{ target: "form" }} />);
      expect(screen.getByRole("link", { name: "Escribir reseña" })).toHaveFocus();
    });
  });

  describe("signed in", () => {
    it("toggles a 'útil' vote optimistically and keeps the server's answer", async () => {
      const [first] = published;
      let resolve!: (value: { ok: true; voted: boolean; helpful: number }) => void;
      vi.mocked(setHelpfulAction).mockReturnValue(new Promise((r) => (resolve = r)));
      renderReviews(<ProductReviews productId="1" initialPage={pageOf(published)} />, ANA);
      await waitUntilViewerLoaded();
      const button = screen.getAllByRole("button", { name: /Útil/ })[0]!;

      fireEvent.click(button);
      expect(button).toHaveTextContent(`Útil (${first!.helpful + 1})`);
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(setHelpfulAction).toHaveBeenCalledWith(first!.id, true);

      // The server counted it: the refetched list and votes carry it.
      server.mine = { review: null, helpful: [first!.id] };
      server.pages = () => pageOf(published.map((r) => (r.id === first!.id ? { ...r, helpful: r.helpful + 1 } : r)));
      await act(async () => resolve({ ok: true, voted: true, helpful: first!.helpful + 1 }));
      await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
      expect(button).toHaveTextContent(`Útil (${first!.helpful + 1})`);

      // Pressed again: takes the vote back.
      vi.mocked(setHelpfulAction).mockResolvedValue({ ok: true, voted: false, helpful: first!.helpful });
      fireEvent.click(button);
      expect(setHelpfulAction).toHaveBeenLastCalledWith(first!.id, false);
    });

    it("rolls a refused vote back and says why", async () => {
      const error = vi.spyOn(showToast, "error").mockImplementation(() => {});
      vi.mocked(setHelpfulAction).mockResolvedValue({ ok: false, error: "Demasiados votos seguidos." });
      renderReviews(<ProductReviews productId="1" initialPage={pageOf(published)} />, ANA);
      await waitUntilViewerLoaded();
      const button = screen.getAllByRole("button", { name: /Útil/ })[0]!;
      fireEvent.click(button);
      await waitFor(() => expect(error).toHaveBeenCalledWith("Demasiados votos seguidos."));
      expect(button).toHaveTextContent(`Útil (${published[0]!.helpful})`);
      expect(button).toHaveAttribute("aria-pressed", "false");
      error.mockRestore();
    });

    it("shows Spanish validation messages and focuses the first invalid field", async () => {
      renderReviews(<ProductReviews productId="2" initialPage={EMPTY} />, ANA);
      await openForm();
      expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
      expect(screen.queryByLabelText(/Tu nombre/)).toBeNull();
      fireEvent.change(screen.getByLabelText(/Tu reseña/), { target: { value: "corto" } });
      fireEvent.click(screen.getByRole("button", { name: "Publicar reseña" }));

      expect(await screen.findByText("Elige una calificación de 1 a 5 estrellas")).toBeInTheDocument();
      expect(screen.getByText("Escribe un título (al menos 3 caracteres)")).toBeInTheDocument();
      expect(screen.getByText("Cuéntanos un poco más (al menos 10 caracteres)")).toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: /Tu calificación/ })).toHaveAttribute("aria-invalid", "true");
      await waitFor(() => expect(screen.getByRole("radio", { name: "1 estrella" })).toHaveFocus());
      expect(createReviewAction).not.toHaveBeenCalled();
    });

    it("publishes through the Server Action, refetches and returns focus to the toggle", async () => {
      renderReviews(<ProductReviews productId="2" initialPage={EMPTY} />, ANA);
      await openForm();
      fireEvent.click(screen.getByRole("radio", { name: "4 estrellas" }));
      fireEvent.change(screen.getByLabelText(/Título/), { target: { value: "  Genial " } });
      fireEvent.change(screen.getByLabelText(/Tu reseña/), { target: { value: "Muy buen set, lo recomiendo" } });
      const mine: Review = { ...published[0]!, id: "new", productId: "2", userName: "Ana Pérez", title: "Genial" };
      server.pages = () => pageOf([mine]);
      server.mine = { review: mine, helpful: [] };
      fireEvent.click(screen.getByRole("button", { name: "Publicar reseña" }));

      await waitFor(() =>
        expect(createReviewAction).toHaveBeenCalledWith("2", { rating: 4, title: "Genial", comment: "Muy buen set, lo recomiendo" })
      );
      expect(await screen.findByRole("heading", { level: 3, name: "Genial" })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole("button", { name: "Editar tu reseña" })).toHaveFocus());
      expect(within(screen.getByTestId("review")).getByText("Tu reseña")).toBeInTheDocument();
    });

    it("shows the server's field errors on the form", async () => {
      vi.mocked(createReviewAction).mockResolvedValue({
        ok: false,
        error: "Revisa los datos de tu reseña.",
        fieldErrors: { title: "Escribe un título (al menos 3 caracteres)" },
      });
      renderReviews(<ProductReviews productId="2" initialPage={EMPTY} />, ANA);
      await openForm();
      fireEvent.click(screen.getByRole("radio", { name: "5 estrellas" }));
      fireEvent.change(screen.getByLabelText(/Título/), { target: { value: "Bien" } });
      fireEvent.change(screen.getByLabelText(/Tu reseña/), { target: { value: "Muy buen set, lo recomiendo" } });
      fireEvent.click(screen.getByRole("button", { name: "Publicar reseña" }));
      expect(await screen.findByText("Escribe un título (al menos 3 caracteres)")).toBeInTheDocument();
      expect(screen.getByLabelText(/Título/)).toHaveAttribute("aria-invalid", "true");
    });

    it("edits and deletes the user's own review, which has no vote button", async () => {
      const own: Review = { ...published[1]!, userName: "Ana Pérez" };
      server.mine = { review: own, helpful: [] };
      server.pages = () => pageOf([published[0]!, own]);
      renderReviews(<ProductReviews productId="1" initialPage={pageOf([published[0]!, own])} />, ANA);

      const item = (await screen.findByText("Tu reseña")).closest("li")!;
      expect(within(item).queryByRole("button", { name: /Útil/ })).toBeNull();

      await openForm("Editar tu reseña", "Guardar cambios");
      expect(screen.getByLabelText(/Título/)).toHaveValue(own.title);
      fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
      await waitFor(() =>
        expect(updateReviewAction).toHaveBeenCalledWith(own.id, { rating: own.rating, title: own.title, comment: own.comment })
      );

      fireEvent.click(within(item).getByRole("button", { name: "Eliminar" }));
      const dialog = await screen.findByRole("dialog", { name: "¿Eliminar tu reseña?" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar reseña" }));
      await waitFor(() => expect(deleteReviewAction).toHaveBeenCalledWith(own.id));
    });

    it("scrolls the whole invalid group (legend, stars, error) to the middle, clear of the sticky header", async () => {
      const scrollIntoView = vi.fn();
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scrollIntoView, configurable: true });
      try {
        renderReviews(<ProductReviews productId="2" initialPage={EMPTY} />, ANA);
        await openForm();
        fireEvent.click(screen.getByRole("button", { name: "Publicar reseña" }));
        await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" }));
        expect(scrollIntoView.mock.contexts.at(-1)).toBe(screen.getByRole("radiogroup", { name: /Tu calificación/ }));
      } finally {
        delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
      }
    });

    it("moves focus to the heading, or opens the form on its first field, when a link asks", async () => {
      const page = pageOf(published);
      const { rerender } = renderReviews(<ProductReviews productId="1" initialPage={page} focusRequest={null} />, ANA);
      await waitFor(() => expect(screen.getByRole("button", { name: "Escribir reseña" })).not.toHaveAttribute("aria-disabled", "true"));
      rerender(<ProductReviews productId="1" initialPage={page} focusRequest={{ target: "heading" }} />);
      expect(screen.getByRole("heading", { level: 2, name: "Reseñas de clientes" })).toHaveFocus();

      await act(async () => rerender(<ProductReviews productId="1" initialPage={page} focusRequest={{ target: "form" }} />));
      expect(screen.getByRole("button", { name: "Cancelar", expanded: true })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole("radio", { name: "1 estrella" })).toHaveFocus());

      // The form is already open: a new request focuses it again.
      screen.getByRole("heading", { level: 2, name: "Reseñas de clientes" }).focus();
      rerender(<ProductReviews productId="1" initialPage={page} focusRequest={{ target: "form" }} />);
      expect(screen.getByRole("radio", { name: "1 estrella" })).toHaveFocus();
    });
  });
});
