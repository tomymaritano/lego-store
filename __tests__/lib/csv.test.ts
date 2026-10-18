import { describe, expect, it } from "vitest";
import { CSV_BOM, csvCell, csvLine, csvStream } from "@/lib/admin/csv";

describe("csvCell", () => {
  it.each([
    ["=HYPERLINK(\"http://evil.test\",\"clic\")", `"'=HYPERLINK(""http://evil.test"",""clic"")"`],
    ["+5491155550000", "'+5491155550000"],
    ["-2+3", "'-2+3"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\tcmd", "'\tcmd"],
    ["\r=1", "\"'\r=1\""],
  ])("neutralises a formula: %j", (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it("quotes separators, quotes and line breaks (RFC 4180) and leaves plain text alone", () => {
    expect(csvCell("Pérez; Ana")).toBe('"Pérez; Ana"');
    expect(csvCell('Set "UCS"')).toBe('"Set ""UCS"""');
    expect(csvCell("línea 1\nlínea 2")).toBe('"línea 1\nlínea 2"');
    expect(csvCell("Av. Corrientes, 1234")).toBe('"Av. Corrientes, 1234"');
    expect(csvCell("Millennium Falcon")).toBe("Millennium Falcon");
  });

  it("writes numbers as numbers (negatives too), booleans in Spanish and nothing for null", () => {
    expect(csvCell(-500)).toBe("-500");
    expect(csvCell(2490)).toBe("2490");
    expect(csvCell(Number.NaN)).toBe("");
    expect(csvCell(true)).toBe("sí");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("joins a line with ; and CRLF", () => {
    expect(csvLine(["a", 1, null, "=x"])).toBe("a;1;;'=x\r\n");
  });
});

describe("csvStream", () => {
  it("starts with the BOM and the header, then each batch until the cursor is null", async () => {
    const batches = [
      { lines: [["uno", 1]], cursor: 1 },
      { lines: [["dos", 2]], cursor: null },
    ];
    let calls = 0;
    const stream = csvStream<number>(["Nombre", "N"], async () => batches[calls++]!);
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    // The UTF-8 BOM itself (EF BB BF): a text() read would strip it.
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    expect(text).toBe(`${CSV_BOM}Nombre;N\r\nuno;1\r\ndos;2\r\n`);
    expect(calls).toBe(2);
  });
});
