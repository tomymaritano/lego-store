import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore } from "@/stores/themeStore";
import { THEME_SCRIPT, THEME_STORAGE_KEY, resolveDark } from "@/lib/theme";

describe("themeStore", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: "system" });
    document.documentElement.classList.remove("dark");
  });

  it("starts with the system theme", () => {
    expect(useThemeStore.getState().theme).toBe("system");
  });

  it("sets any theme without touching the DOM (ThemeSync does that)", () => {
    useThemeStore.getState().setTheme("dark");
    expect(useThemeStore.getState().theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("toggles between light and dark", () => {
    const { setTheme, toggleTheme } = useThemeStore.getState();
    setTheme("light");
    toggleTheme();
    expect(useThemeStore.getState().theme).toBe("dark");
    toggleTheme();
    expect(useThemeStore.getState().theme).toBe("light");
  });

  it("toggling from system flips what is on screen", () => {
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("dark");

    useThemeStore.setState({ theme: "system" });
    document.documentElement.classList.add("dark");
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("light");
  });

  it("migrates and validates the persisted value", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ state: { theme: "neon" }, version: 0 }));
    await useThemeStore.persist.rehydrate();
    expect(useThemeStore.getState().theme).toBe("system");

    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ state: { theme: "dark" }, version: 0 }));
    await useThemeStore.persist.rehydrate();
    expect(useThemeStore.getState().theme).toBe("dark");
  });
});

describe("lib/theme", () => {
  it("resolves dark from the preference and the system", () => {
    expect(resolveDark("dark", false)).toBe(true);
    expect(resolveDark("light", true)).toBe(false);
    expect(resolveDark("system", true)).toBe(true);
    expect(resolveDark("system", false)).toBe(false);
  });

  it("the inline <head> script applies the stored theme", () => {
    const run = () => new Function(THEME_SCRIPT)();
    const root = document.documentElement;

    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ state: { theme: "dark" }, version: 1 }));
    run();
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.style.colorScheme).toBe("dark");

    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ state: { theme: "light" }, version: 1 }));
    run();
    expect(root.classList.contains("dark")).toBe(false);

    localStorage.setItem(THEME_STORAGE_KEY, "{not json");
    expect(run).not.toThrow();
  });
});
