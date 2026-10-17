import { describe, it, expect } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { useGalleryImages } from "@/components/product/ProductThumbnails";
import { CategoriesProvider, CategoryName, useCategoryName } from "@/providers/CategoriesProvider";

describe("useGalleryImages", () => {
  it("drops images that fail to load and keeps the selection by src", () => {
    const { result } = renderHook(() => useGalleryImages(["/a.png", "/b.png", "/c.png"]));
    act(() => result.current.select(2));
    expect(result.current.selectedSrc).toBe("/c.png");

    act(() => result.current.markFailed("/b.png"));
    expect(result.current.images).toEqual(["/a.png", "/c.png"]);
    expect(result.current.selected).toBe(1);
    expect(result.current.selectedSrc).toBe("/c.png");
  });

  it("falls back to the first image when the selected one fails, and never drops the first", () => {
    const { result } = renderHook(() => useGalleryImages(["/a.png", "/b.png"]));
    act(() => result.current.select(1));
    act(() => result.current.markFailed("/b.png"));
    act(() => result.current.markFailed("/a.png"));
    expect(result.current.images).toEqual(["/a.png"]);
    expect(result.current.selectedSrc).toBe("/a.png");
  });
});

describe("CategoriesProvider", () => {
  const categories = [
    { id: "helmet", name: "Helmets" },
    { id: "cars", name: "Vehículos" },
  ];

  it("resolves display names and falls back to the slug", () => {
    const { result } = renderHook(() => [useCategoryName("cars"), useCategoryName("unknown")], {
      wrapper: ({ children }) => <CategoriesProvider categories={categories}>{children}</CategoriesProvider>,
    });
    expect(result.current).toEqual(["Vehículos", "unknown"]);
  });

  it("renders the name inline", () => {
    render(
      <CategoriesProvider categories={categories}>
        <p>
          <CategoryName id="helmet" />
        </p>
      </CategoriesProvider>
    );
    expect(screen.getByText("Helmets")).toBeInTheDocument();
  });
});
