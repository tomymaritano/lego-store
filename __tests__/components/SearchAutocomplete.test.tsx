import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { SearchAutocomplete } from "@/components/search/SearchAutocomplete";
import { mockFetch, renderWithQuery } from "../helpers/render";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const requests: string[] = [];

describe("SearchAutocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requests.length = 0;
    mockFetch((url) => {
      requests.push(url.pathname + url.search);
      const q = url.searchParams.get("q") ?? "";
      return q.toLowerCase().startsWith("star")
        ? {
            items: [
              { id: "1", name: "Captain Rex Helmet", price: 899, img: "/rex.png", theme: "Star Wars" },
              { id: "3", name: "Clone Commander Cody Helmet", price: 649, img: "/cody.png", theme: "Star Wars" },
            ],
            total: 9,
          }
        : { items: [], total: 0 };
    });
  });

  it("asks /api/search (debounced) and lists the suggestions as options", async () => {
    renderWithQuery(<SearchAutocomplete />);
    const input = screen.getByRole("combobox", { name: "Buscar productos" });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "s" } });
    fireEvent.change(input, { target: { value: "star" } });

    expect(await screen.findByRole("option", { name: /Captain Rex Helmet/ })).toBeInTheDocument();
    expect(requests).toEqual(["/api/search?q=star&limit=5"]);
    expect(screen.getByRole("button", { name: /Ver los 9 resultados/ })).toBeInTheDocument();
  });

  it("navigates the options with the keyboard and opens the product", async () => {
    renderWithQuery(<SearchAutocomplete />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "star" } });
    await screen.findAllByRole("option");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const active = screen.getByRole("option", { name: /Cody/ });
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", active.id);

    fireEvent.keyDown(input, { key: "Enter" });
    expect(router.push).toHaveBeenCalledWith("/item/3");
  });

  it("runs the full search on Enter and remembers it", () => {
    renderWithQuery(<SearchAutocomplete />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "  millennium falcon " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(router.push).toHaveBeenCalledWith("/search?q=millennium%20falcon");
    expect(JSON.parse(localStorage.getItem("lego-recent-searches")!)).toEqual(["millennium falcon"]);
  });

  it("says so when nothing matches", async () => {
    renderWithQuery(<SearchAutocomplete />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzz" } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sin resultados para zzz"));
    expect(screen.getByText('No se encontraron productos para "zzz"')).toBeInTheDocument();
  });

  it("announces how many suggestions there are", async () => {
    renderWithQuery(<SearchAutocomplete />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "star" } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("2 sugerencias de 9 resultados"));
  });

  it("highlights the query inside each suggestion", async () => {
    renderWithQuery(<SearchAutocomplete />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    mockFetch(() => ({ items: [{ id: "1", name: "Captain Rex Helmet", price: 899, img: "/rex.png", theme: "Star Wars" }], total: 1 }));
    fireEvent.change(input, { target: { value: "rex helm" } });
    const option = await screen.findByRole("option", { name: /Captain/ });
    expect(option).toHaveTextContent("Captain Rex Helmet");
    expect([...option.querySelectorAll("mark")].map((m) => m.textContent)).toEqual(["Rex", "Helm"]);
  });

  it("inline variant (mobile) always shows the listbox and lets Escape through on an empty field", () => {
    localStorage.setItem("lego-recent-searches", JSON.stringify(["batman"]));
    const onKeyDown = vi.fn();
    renderWithQuery(
      <div onKeyDown={onKeyDown}>
        <SearchAutocomplete variant="inline" />
      </div>
    );
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox", { hidden: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Star Wars" })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "lego" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
    expect(onKeyDown).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });
});

describe("SearchAutocomplete focus handling", () => {
  beforeEach(() => {
    mockFetch(() => ({ items: [], total: 0 }));
    localStorage.setItem("lego-recent-searches", JSON.stringify(["batman"]));
  });

  it("stays collapsed while the panel only shows popular-search chips (no options)", () => {
    localStorage.clear();
    renderWithQuery(<SearchAutocomplete />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    expect(screen.getByRole("button", { name: "Star Wars" })).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("expands once recent searches give the listbox options", () => {
    renderWithQuery(<SearchAutocomplete />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("option", { name: /batman/ })).toBeInTheDocument();
  });

  it("closes when keyboard focus leaves the combobox", () => {
    renderWithQuery(
      <>
        <SearchAutocomplete />
        <button type="button">Después</button>
      </>
    );
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    expect(input).toHaveAttribute("aria-expanded", "true");

    const outside = screen.getByRole("button", { name: "Después" });
    fireEvent.blur(input, { relatedTarget: outside });
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("stays open while focus moves inside the panel", () => {
    renderWithQuery(<SearchAutocomplete />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    const chip = screen.getByRole("button", { name: "Star Wars" });
    fireEvent.blur(input, { relatedTarget: chip });
    expect(input).toHaveAttribute("aria-expanded", "true");
  });
});
