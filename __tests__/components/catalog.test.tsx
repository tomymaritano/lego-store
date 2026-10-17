import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductFilters } from "@/components/product/ProductFilters";
import { ActiveFilters } from "@/components/product/ActiveFilters";
import type { FacetCounts, FilterOptions } from "@/types";

const nav = vi.hoisted(() => ({ search: "", pathname: "/search" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const options: FilterOptions = {
  categories: [
    { value: "helmet", label: "Helmets", count: 5 },
    { value: "cars", label: "Vehículos", count: 3 },
  ],
  themes: Array.from({ length: 8 }, (_, i) => ({ value: `Tema ${i + 1}`, label: `Tema ${i + 1}`, count: i + 1 })),
  types: [{ value: "Sets", label: "Sets", count: 8 }],
  ages: [
    { value: "12+", label: "12+", count: 2 },
    { value: "18+", label: "18+", count: 6 },
  ],
  interests: [],
  pieces: [],
  highlights: [],
  price: { min: 100, max: 1000 },
  ratings: [{ value: "4", label: "4 estrellas o más", count: 7 }],
  flags: { onSale: 2, inStock: 8, isNew: 0 },
  total: 8,
};

describe("ProductFilters", () => {
  it("shows counts, hides single-value facets and empty flags", () => {
    render(<ProductFilters options={options} query={{}} onChange={() => {}} showCategories />);
    expect(screen.getByRole("checkbox", { name: "En oferta (2)" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Novedades/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Tipo" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Vehículos (3)" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Precio mínimo" })).toBeInTheDocument();
  });

  it("starts the rarer facets (Edad, Tipo, Piezas) collapsed, open when one of their values is selected", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ProductFilters options={options} query={{}} onChange={() => {}} />);
    const ages = screen.getByText("Edad", { selector: "legend" }).closest("details")!;
    const toggle = ages.querySelector("summary")!;
    expect(ages).not.toHaveAttribute("open");
    // Tema is a frequent facet: always open, a plain group.
    expect(screen.getByRole("group", { name: "Tema" }).closest("details")).toBeNull();

    await user.click(toggle);
    expect(ages).toHaveAttribute("open");
    await user.click(toggle);
    expect(ages).not.toHaveAttribute("open");

    // Selected elsewhere (chip, URL): the group opens and its summary shows how many.
    rerender(<ProductFilters options={options} query={{ ages: ["18+"] }} onChange={() => {}} />);
    expect(ages).toHaveAttribute("open");
    expect(toggle).toHaveTextContent("Edad(1 seleccionado)");
    expect(screen.getByRole("checkbox", { name: "18+ (6)" })).toBeChecked();
  });

  it("shows live counts from `counts` without dropping options in scope", () => {
    const counts: FacetCounts = {
      categories: { helmet: 2 },
      themes: { "Tema 1": 1 },
      types: {},
      ages: { "18+": 3 },
      interests: {},
      pieces: {},
      highlights: {},
      ratings: { "4": 2 },
      flags: { onSale: 1, inStock: 3, isNew: 0 },
      anyCategory: 3,
      anyRating: 3,
    };
    render(<ProductFilters options={options} counts={counts} query={{ ages: ["18+"] }} onChange={() => {}} showCategories />);
    // The accessible name carries the live number, not the scope total.
    expect(screen.getByRole("checkbox", { name: "En oferta (1)" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Helmets (2)" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Vehículos (0)" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: "Todas (3)" })).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "4 estrellas o más (2)" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Tema 2 (0)" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "18+ (3)" })).toBeChecked();
  });

  it("toggles list values and flags through onChange", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<ProductFilters options={options} query={{}} onChange={onChange} />);

    await user.click(screen.getByRole("checkbox", { name: "Tema 2 (2)" }));
    expect(onChange).toHaveBeenLastCalledWith({ themes: ["Tema 2"] });

    rerender(<ProductFilters options={options} query={{ themes: ["Tema 2"], onSale: true }} onChange={onChange} />);
    await user.click(screen.getByRole("checkbox", { name: "Tema 2 (2)" }));
    expect(onChange).toHaveBeenLastCalledWith({ themes: undefined });
    await user.click(screen.getByRole("checkbox", { name: "En oferta (2)" }));
    expect(onChange).toHaveBeenLastCalledWith({ onSale: undefined });
  });

  it("long lists collapse behind 'Ver N más' but keep selected values visible", async () => {
    const user = userEvent.setup();
    render(<ProductFilters options={options} query={{ themes: ["Tema 8"] }} onChange={() => {}} />);
    expect(screen.queryByRole("checkbox", { name: /Tema 7/ })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Tema 8/ })).toBeChecked();
    const more = screen.getByRole("button", { name: "Ver 1 más" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    await user.click(more);
    expect(screen.getByRole("checkbox", { name: /Tema 7/ })).toBeInTheDocument();
  });
});

describe("ActiveFilters", () => {
  it("names each chip and removes it", async () => {
    const onRemove = vi.fn();
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(
      <ActiveFilters query={{ category: "cars", themes: ["Marvel"] }} options={options} onRemove={onRemove} onClear={onClear} />
    );
    expect(screen.getByRole("region", { name: "Filtros activos" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar filtro Categoría: Vehículos" }));
    expect(onRemove).toHaveBeenCalledWith({ field: "category", value: "cars" });
    await user.click(screen.getByRole("button", { name: "Limpiar todo" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("renders nothing without filters", () => {
    const { container } = render(<ActiveFilters query={{ q: "star", sort: "rating" }} onRemove={() => {}} onClear={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("useCatalogQuery", () => {
  beforeEach(() => {
    nav.pathname = "/search";
    window.history.replaceState(null, "", "/search?q=star&theme=Marvel&page=3&sort=rating");
  });

  it("reads the URL without paging and pushes changes to history", async () => {
    const { useCatalogQuery } = await import("@/hooks/useCatalogQuery");
    const push = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() => useCatalogQuery());
    expect(result.current.query).toEqual({ q: "star", themes: ["Marvel"], sort: "rating" });

    act(() => result.current.update({ onSale: true }));
    expect(push).toHaveBeenLastCalledWith(null, "", "/search?q=star&theme=Marvel&onSale=1&sort=rating");

    act(() => result.current.clear());
    expect(push).toHaveBeenLastCalledWith(null, "", "/search?q=star&sort=rating");
    push.mockRestore();
  });

  it("follows Back/Forward (popstate)", async () => {
    const { useCatalogQuery } = await import("@/hooks/useCatalogQuery");
    const { result } = renderHook(() => useCatalogQuery());
    act(() => {
      window.history.replaceState(null, "", "/search?q=lego");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.query).toEqual({ q: "lego" });
  });

  it("ignores the route's scope keys (a stray ?category= on a category page)", async () => {
    nav.pathname = "/category/helmet";
    window.history.replaceState(null, "", "/category/helmet?category=technic&theme=Marvel");
    const { useCatalogQuery } = await import("@/hooks/useCatalogQuery");
    const push = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() => useCatalogQuery(["category"]));
    expect(result.current.query).toEqual({ themes: ["Marvel"] });

    act(() => result.current.clear());
    expect(push).toHaveBeenLastCalledWith(null, "", "/category/helmet");
    push.mockRestore();
  });
});
