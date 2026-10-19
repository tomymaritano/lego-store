import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act } from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeScript } from "@/components/layout/ThemeScript";
import { THEME_SCRIPT } from "@/lib/theme";

describe("ThemeScript", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is in the server HTML", () => {
    expect(renderToString(<ThemeScript />)).toContain(THEME_SCRIPT);
  });

  it("hydrates without mismatches", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<ThemeScript />);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      hydrateRoot(container, <ThemeScript />);
    });
    expect(errors).not.toHaveBeenCalled();
  });

  it("renders nothing (and no React script warning) in a client-only render, like Next's error shell", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<ThemeScript />);
    expect(container.querySelector("script")).toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });
});
