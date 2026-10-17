import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ProductReviews, sortReviews } from "@/components/product/ProductReviews";
import { useReviewStore } from "@/stores/reviewStore";
import { mockReviews } from "../../prisma/seed/mock-reviews";
import type { Review } from "@/types";

const review = (id: string, rating: number, helpful: number, date: string): Review => ({
  id,
  productId: "p",
  userId: "u",
  userName: "Ana",
  rating,
  title: id,
  comment: "Muy buen set",
  date,
  helpful,
  verified: false,
});

describe("sortReviews", () => {
  const list = [review("a", 3, 10, "2024-01-01"), review("b", 5, 2, "2024-03-01"), review("c", 1, 2, "2024-02-01")];
  it.each([
    ["recent", ["b", "c", "a"]],
    ["helpful", ["a", "b", "c"]],
    ["highest", ["b", "a", "c"]],
    ["lowest", ["c", "a", "b"]],
  ] as const)("orders by %s (ties: newest first) without mutating the input", (sort, ids) => {
    expect(sortReviews(list, sort).map((r) => r.id)).toEqual(ids);
    expect(list.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

/** Opens the review form; it loads on demand, so wait for its submit button. */
async function openForm() {
  fireEvent.click(screen.getByRole("button", { name: "Escribir reseña" }));
  await screen.findByRole("button", { name: "Publicar reseña" }, { timeout: 5000 });
}

describe("ProductReviews", () => {
  // The form is a next/dynamic chunk: warm the module once so a busy parallel run
  // does not spend the first test's timeout on importing zod and react-hook-form.
  beforeAll(async () => {
    await import("@/components/product/reviews/ReviewForm");
  });
  beforeEach(() => useReviewStore.setState({ reviews: [], helpfulVotes: [] }));
  // Published reviews of product 1, as the product page reads them from the database.
  const published = mockReviews.filter((r) => r.productId === "1");

  it("shows the product's reviews with h2 > h3 headings inside a labelled section", () => {
    render(<ProductReviews productId="1" publishedReviews={published} />);
    const section = screen.getByRole("region", { name: "Reseñas de clientes" });
    const titles = within(section).getAllByRole("heading", { level: 3 });
    expect(titles.length).toBe(published.length);
    expect(within(section).queryByRole("heading", { level: 4 })).toBeNull();
  });

  it("formats dates in Spanish and lists the newest first", () => {
    render(<ProductReviews productId="1" publishedReviews={published} />);
    const times = screen.getAllByRole("listitem").flatMap((li) => Array.from(li.querySelectorAll("time")));
    expect(times.map((t) => t.getAttribute("datetime"))).toEqual(["2024-01-15", "2024-01-10"]);
    expect(times[0]).toHaveTextContent("15 de enero de 2024");
  });

  it("counts a helpful vote once and keeps focus on the button", () => {
    render(<ProductReviews productId="1" publishedReviews={published} />);
    const [first] = screen.getAllByRole("button", { name: /Útil/ });
    const before = Number(first.textContent?.match(/\((\d+)\)/)?.[1]);
    fireEvent.click(first);
    fireEvent.click(first);
    expect(first).toHaveTextContent(`Útil (${before + 1})`);
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(first).toHaveAttribute("aria-disabled", "true");
    expect(useReviewStore.getState().helpfulVotes).toHaveLength(1);
  });

  it("lists the visitor's own reviews of the product above the published ones", () => {
    useReviewStore.getState().addReview({
      productId: "1",
      userId: "me",
      userName: "Yo",
      rating: 3,
      title: "La mía",
      comment: "Escrita en este navegador",
      verified: false,
    });
    render(<ProductReviews productId="1" publishedReviews={published} />);
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toHaveLength(published.length + 1);
    expect(titles[0]).toBe("La mía");
  });

  it("shows Spanish validation messages and focuses the first invalid field", async () => {
    render(<ProductReviews productId="2" />);
    await openForm();
    fireEvent.change(screen.getByLabelText(/Tu reseña/), { target: { value: "corto" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar reseña" }));

    expect(await screen.findByText("Elige una calificación de 1 a 5 estrellas")).toBeInTheDocument();
    expect(screen.getByText("Ingresa tu nombre (al menos 2 caracteres)")).toBeInTheDocument();
    expect(screen.getByText("Escribe un título (al menos 3 caracteres)")).toBeInTheDocument();
    expect(screen.getByText("Cuéntanos un poco más (al menos 10 caracteres)")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /Tu calificación/ })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/Tu nombre/)).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(screen.getByRole("radio", { name: "1 estrella" })).toHaveFocus());
    expect(useReviewStore.getState().reviews.filter((r) => r.productId === "2")).toHaveLength(0);
  });

  it("adds a review from the form and returns focus to the toggle", async () => {
    render(<ProductReviews productId="2" />);
    await openForm();
    fireEvent.click(screen.getByRole("radio", { name: "4 estrellas" }));
    fireEvent.change(screen.getByLabelText(/Tu nombre/), { target: { value: "  Ana  " } });
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: "Genial" } });
    fireEvent.change(screen.getByLabelText(/Tu reseña/), { target: { value: "Muy buen set, lo recomiendo" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar reseña" }));

    expect(await screen.findByRole("heading", { level: 3, name: "Genial" })).toBeInTheDocument();
    const saved = useReviewStore.getState().reviews.find((r) => r.productId === "2");
    expect(saved).toMatchObject({ userName: "Ana", rating: 4, title: "Genial", verified: false, helpful: 0 });
    await waitFor(() => expect(screen.getByRole("button", { name: "Escribir reseña" })).toHaveFocus());
  });

  it("scrolls the whole invalid group (legend, stars, error) to the middle, clear of the sticky header", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scrollIntoView, configurable: true });
    try {
      render(<ProductReviews productId="2" />);
      await openForm();
      fireEvent.click(screen.getByRole("button", { name: "Publicar reseña" }));
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" }));
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(screen.getByRole("radiogroup", { name: /Tu calificación/ }));
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    }
  });

  it("with no reviews shows only an empty state, never a 0-star score or an empty histogram", () => {
    render(<ProductReviews productId="2" />);
    expect(screen.getByRole("heading", { level: 3, name: "Aún no hay reseñas" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Valoración/ })).toBeNull();
    expect(screen.queryByRole("list", { name: "Distribución de valoraciones" })).toBeNull();
    expect(screen.queryByText(/de 5/)).toBeNull();
  });

  it("moves focus to the heading, or opens the form on its first field, when a link asks", async () => {
    const { rerender } = render(<ProductReviews productId="1" publishedReviews={published} focusRequest={null} />);
    rerender(<ProductReviews productId="1" publishedReviews={published} focusRequest={{ target: "heading" }} />);
    expect(screen.getByRole("heading", { level: 2, name: "Reseñas de clientes" })).toHaveFocus();

    await act(async () => rerender(<ProductReviews productId="1" publishedReviews={published} focusRequest={{ target: "form" }} />));
    expect(screen.getByRole("button", { name: "Cancelar", expanded: true })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("radio", { name: "1 estrella" })).toHaveFocus());

    // The form is already open: a new request focuses it again.
    screen.getByRole("heading", { level: 2, name: "Reseñas de clientes" }).focus();
    rerender(<ProductReviews productId="1" publishedReviews={published} focusRequest={{ target: "form" }} />);
    expect(screen.getByRole("radio", { name: "1 estrella" })).toHaveFocus();
  });
});
