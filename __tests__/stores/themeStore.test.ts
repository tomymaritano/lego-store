import { describe, it, expect, beforeEach, vi } from "vitest";
import { useThemeStore } from "@/stores/themeStore";

// Mock matchMedia
const mockMatchMedia = vi.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: mockMatchMedia,
});

describe("Theme Store", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: "system" });
    document.documentElement.classList.remove("dark");
  });

  it("should start with system theme", () => {
    const { theme } = useThemeStore.getState();
    expect(theme).toBe("system");
  });

  it("should set theme to light", () => {
    const { setTheme } = useThemeStore.getState();

    setTheme("light");

    expect(useThemeStore.getState().theme).toBe("light");
  });

  it("should set theme to dark", () => {
    const { setTheme } = useThemeStore.getState();

    setTheme("dark");

    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("should set theme to system", () => {
    const { setTheme } = useThemeStore.getState();

    setTheme("light");
    setTheme("system");

    expect(useThemeStore.getState().theme).toBe("system");
  });

  it("should toggle theme from light to dark", () => {
    const { setTheme, toggleTheme } = useThemeStore.getState();

    setTheme("light");
    toggleTheme();

    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("should toggle theme from dark to light", () => {
    const { setTheme, toggleTheme } = useThemeStore.getState();

    setTheme("dark");
    toggleTheme();

    expect(useThemeStore.getState().theme).toBe("light");
  });

  it("should toggle theme from system to dark", () => {
    const { setTheme, toggleTheme } = useThemeStore.getState();

    setTheme("system");
    toggleTheme();

    // The toggle logic: current === "dark" ? "light" : "dark"
    // When system is selected, it's not "dark", so it goes to "dark"
    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("should support cycling between light and dark", () => {
    const { setTheme, toggleTheme } = useThemeStore.getState();

    setTheme("light");
    expect(useThemeStore.getState().theme).toBe("light");

    toggleTheme();
    expect(useThemeStore.getState().theme).toBe("dark");

    toggleTheme();
    expect(useThemeStore.getState().theme).toBe("light");
  });
});
