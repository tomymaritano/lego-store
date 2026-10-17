import { describe, it, expect, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { TrackRecentlyViewed } from "@/components/product/RecentlyViewed";
import { ProductGallery, gallerySources } from "@/components/product/ProductGallery";
import { StockStatus } from "@/components/product/ProductPurchase";
import { ReviewsLink, reviewsLinkLabel } from "@/components/product/ReviewsLink";
import { REVIEWS_HASH } from "@/components/product/anchors";
import { mockReviews, useReviewStore } from "@/stores/reviewStore";
import { useRecentlyViewedStore } from "@/stores";
import { productImages, productJsonLd, serializeJsonLd } from "@/lib/structuredData";
import { PLACEHOLDER_IMAGE } from "@/lib/utils";
import type { Product } from "@/types";

const product: Product = {
  id: "10",
  name: "Batcueva",
  price: 100,
  isNew: false,
  isOnSale: false,
  rating: 4.4,
  category: "brickheadz",
  type: "Sets",
  age: "16+",
  theme: "Marvel",
  interests: [],
  pieces: "501-1000",
  highlight: "Exclusivos",
  img: "/a.png",
  images: ["/a.png", "/b.png", "/c.png"],
  stock: 3,
  shortDescription: "Caja",
  description: "Batcueva </script> premium",
};

describe("TrackRecentlyViewed", () => {
  beforeEach(() => useRecentlyViewedStore.setState({ ids: [] }));

  it("waits for the saved history before recording, so a full page load keeps it", async () => {
    localStorage.setItem("lego-recently-viewed", JSON.stringify({ state: { ids: ["2", "3"] }, version: 1 }));
    const { rerender } = render(<TrackRecentlyViewed productId="1" />);
    // Not hydrated yet: nothing recorded, the saved history is untouched.
    expect(JSON.parse(localStorage.getItem("lego-recently-viewed")!).state.ids).toEqual(["2", "3"]);

    await act(() => useRecentlyViewedStore.persist.rehydrate());
    expect(useRecentlyViewedStore.getState().ids).toEqual(["1", "2", "3"]);

    // Client-side navigation to another product records it too.
    rerender(<TrackRecentlyViewed productId="3" />);
    expect(useRecentlyViewedStore.getState().ids).toEqual(["3", "1", "2"]);
  });
});

describe("ProductGallery", () => {
  it("puts the main picture first without duplicates", () => {
    expect(gallerySources({ img: "/b.png", images: ["/a.png", "/b.png"] })).toEqual(["/b.png", "/a.png"]);
  });

  it("moves with the prev/next buttons and arrow keys on the thumbnails", () => {
    render(<ProductGallery product={product} />);
    const thumb = (n: number) => screen.getByRole("button", { name: `Ver imagen ${n} de 3` });
    expect(thumb(1)).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Imagen siguiente" }));
    expect(thumb(2)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Imagen 2 de 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Imagen anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Imagen anterior" }));
    expect(thumb(3)).toHaveAttribute("aria-pressed", "true");

    thumb(3).focus();
    fireEvent.keyDown(thumb(3), { key: "Home" });
    expect(thumb(1)).toHaveAttribute("aria-pressed", "true");
    expect(thumb(1)).toHaveFocus();
    fireEvent.keyDown(thumb(1), { key: "ArrowLeft" });
    expect(thumb(3)).toHaveFocus();
  });
});

describe("StockStatus", () => {
  it.each([
    [0, "Agotado"],
    [1, "¡Última unidad disponible!"],
    [4, "¡Últimas 4 unidades!"],
    [20, "En stock · 20 unidades disponibles"],
  ])("stock %i reads %s", (stock, text) => {
    render(<StockStatus stock={stock} />);
    expect(screen.getByTestId("stock-status")).toHaveTextContent(text);
  });
});

describe("product structured data", () => {
  it("describes the offer with absolute URLs and never lists the placeholder", () => {
    const data = productJsonLd({ ...product, images: [PLACEHOLDER_IMAGE] }, "Brickheadz");
    expect(data).toMatchObject({
      "@type": "Product",
      sku: "10",
      category: "Brickheadz",
      offers: { price: 100, priceCurrency: "ARS", availability: "https://schema.org/InStock" },
    });
    expect(data.image).toEqual([expect.stringMatching(/^https?:\/\/.+\/a\.png$/)]);
    expect(productImages({ img: PLACEHOLDER_IMAGE, images: [] })).toEqual([]);
    expect(productJsonLd({ ...product, stock: 0 }).offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("escapes < so the JSON cannot close its script tag", () => {
    expect(serializeJsonLd(productJsonLd(product))).not.toContain("</script>");
  });
});

describe("ReviewsLink", () => {
  beforeEach(() => useReviewStore.setState({ reviews: mockReviews }));

  it("counts the reviews the tab will show, from the same store", () => {
    const count = mockReviews.filter((r) => r.productId === "1").length;
    render(<ReviewsLink productId="1" />);
    expect(screen.getByRole("link", { name: `Ver ${count} reseñas` })).toHaveAttribute("href", `#${REVIEWS_HASH}`);
  });

  it("does not promise reviews when there are none", () => {
    render(<ReviewsLink productId="no-reviews" />);
    expect(screen.getByRole("link")).toHaveTextContent("Aún sin reseñas · Escribe la primera");
    expect(reviewsLinkLabel(1)).toBe("Ver 1 reseña");
  });
});
