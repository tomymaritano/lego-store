import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ProductReviews } from "@/components/product/ProductReviews";
import { mockReviews, useReviewStore } from "@/stores/reviewStore";

describe("ProductReviews", () => {
  beforeEach(() => useReviewStore.setState({ reviews: mockReviews }));

  it("shows the product's reviews with h2 > h3 headings inside a labelled section", () => {
    render(<ProductReviews productId="1" />);
    const section = screen.getByRole("region", { name: "Reseñas de clientes" });
    const titles = within(section).getAllByRole("heading", { level: 3 });
    expect(titles.length).toBe(mockReviews.filter((r) => r.productId === "1").length);
    expect(within(section).queryByRole("heading", { level: 4 })).toBeNull();
  });

  it("counts a helpful vote once", () => {
    render(<ProductReviews productId="1" />);
    const [first] = screen.getAllByRole("button", { name: /Útil/ });
    const before = Number(first.textContent?.match(/\((\d+)\)/)?.[1]);
    fireEvent.click(first);
    fireEvent.click(first);
    expect(first).toHaveTextContent(`Útil (${before + 1})`);
    expect(first).toHaveAttribute("aria-pressed", "true");
  });

  it("adds a review from the form", () => {
    render(<ProductReviews productId="2" />);
    expect(screen.getByText("Aún no hay reseñas para este producto.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Escribir reseña" }));
    fireEvent.click(screen.getByRole("radio", { name: "4 estrellas" }));
    fireEvent.change(screen.getByLabelText(/Tu nombre/), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: "Genial" } });
    fireEvent.change(screen.getByLabelText(/Tu reseña/), { target: { value: "Muy buen set" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar reseña" }));
    expect(screen.getByRole("heading", { level: 3, name: "Genial" })).toBeInTheDocument();
  });
});
