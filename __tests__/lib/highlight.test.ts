import { describe, it, expect } from "vitest";
import { highlightMatches } from "@/lib/highlight";

const marked = (text: string, query: string) =>
  highlightMatches(text, query)
    .filter((s) => s.match)
    .map((s) => s.text);

describe("highlightMatches", () => {
  it("marks every occurrence of each word, case-insensitively", () => {
    expect(marked("Star Wars Star Destroyer", "star")).toEqual(["Star", "Star"]);
    expect(marked("Captain Rex Helmet", "rex HELM")).toEqual(["Rex", "Helm"]);
  });

  it("ignores accents in both text and query and keeps the original characters", () => {
    expect(marked("Vehículo Ártico", "vehiculo artico")).toEqual(["Vehículo", "Ártico"]);
    expect(marked("Vehiculo", "vehículo")).toEqual(["Vehiculo"]);
  });

  it("joins the segments back into the original text", () => {
    const text = "Millennium Falcon™ — Edición";
    expect(highlightMatches(text, "falcon edicion").map((s) => s.text).join("")).toBe(text);
  });

  it("returns the text unmarked for an empty query and nothing for empty text", () => {
    expect(highlightMatches("Batman", "  ")).toEqual([{ text: "Batman", match: false }]);
    expect(highlightMatches("", "bat")).toEqual([]);
  });
});
