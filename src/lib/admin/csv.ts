/*
 * CSV for the admin's exports (src/lib/admin/exports.ts), written for Excel
 * as much as for anything else:
 *
 * - UTF-8 with a BOM, so Excel reads "Pérez" and "Envío" right.
 * - ";" between fields: what Excel expects in Spanish locales (es-AR uses
 *   "," as the decimal separator, so its list separator is ";"); Google
 *   Sheets, LibreOffice and pandas detect it too. Amounts are whole pesos.
 * - RFC 4180 quoting: a field with the separator, a quote or a line break
 *   goes between quotes, with its quotes doubled; lines end in CRLF.
 * - CSV injection: a field a spreadsheet would read as a formula (it starts
 *   with =, +, -, @, a tab or a carriage return) gets a leading apostrophe,
 *   so a customer's name like "=HYPERLINK(...)" stays text. Numbers are
 *   written as numbers (a negative amount is a number, not a formula).
 */

export const CSV_SEPARATOR = ";";
export const CSV_BOM = "﻿";
const LINE_END = "\r\n";

export type CsvValue = string | number | boolean | Date | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

/** One field, escaped and neutralised (see above). */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "sí" : "no";
  let text = value instanceof Date ? value.toISOString() : value;
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[";\r\n,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One line, CRLF included. */
export const csvLine = (values: readonly CsvValue[]) => values.map(csvCell).join(CSV_SEPARATOR) + LINE_END;

/**
 * A streamed CSV body: the BOM and the header first, then the rows of each
 * batch `next` returns until it returns none. Batches are read one at a
 * time as the client takes them (pull), so a big export never sits whole
 * in memory.
 */
export function csvStream<T>(header: readonly string[], next: (cursor: T | null) => Promise<{ lines: CsvValue[][]; cursor: T | null }>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cursor: T | null = null;
  let started = false;
  let done = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!started) {
        started = true;
        controller.enqueue(encoder.encode(CSV_BOM + csvLine(header)));
        return;
      }
      if (done) return;
      try {
        const batch = await next(cursor);
        if (batch.lines.length > 0) controller.enqueue(encoder.encode(batch.lines.map(csvLine).join("")));
        cursor = batch.cursor;
        if (batch.cursor === null) {
          done = true;
          controller.close();
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
