/**
 * CSV files the console hands a person to save. Cells are quoted as RFC
 * 4180 says, and a text cell a spreadsheet would run as a formula (one
 * starting with =, +, -, @, a tab or a return) starts with an apostrophe,
 * so opening an export never runs what someone typed into a record.
 */
export type CsvCell = string | number | boolean | null;

const FORMULA = /^[=+\-@\t\r]/;

function cell(value: CsvCell): string {
  if (value === null) return "";
  const text = typeof value === "string" && FORMULA.test(value) ? `'${value}` : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The file's text: a header row, then one line per row, each ending in CRLF. */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  return [header, ...rows].map((row) => `${row.map(cell).join(",")}\r\n`).join("");
}

/** Hands the browser a CSV file to save. Nothing is kept: the file's address is let go as soon as the download starts. */
export function downloadCsv(fileName: string, text: string) {
  // The byte order mark tells spreadsheet apps the file is UTF-8.
  const url = URL.createObjectURL(new Blob(["﻿", text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
